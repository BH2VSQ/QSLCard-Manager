import sys
import os
import sqlite3
import datetime
import secrets
import json
import threading
import socket
import re
from io import BytesIO
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QGridLayout,
                             QPushButton, QLabel, QVBoxLayout, QFrame,
                             QStackedWidget, QMessageBox, QTableView, QHeaderView,
                             QLineEdit, QDateEdit, QComboBox, QHBoxLayout,
                             QFormLayout, QDialog, QDialogButtonBox, QTextEdit,
                             QListWidget, QInputDialog, QFileDialog, QListWidgetItem,
                             QTextBrowser, QGroupBox, QCheckBox)
from PyQt5.QtCore import Qt, QSize, pyqtSignal, QAbstractTableModel, QDate, QTime, QDateTime, QThread, QRectF, QSizeF, QPointF
from PyQt5.QtGui import QIcon, QFont, QImage, QPixmap, QPainter, QColor

# --- Third-party library dependency check (will be handled in main) ---
# --- Third-party library dependency check ---
try:
    import adif_io
    import qrcode
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    # --- 新增: PDF417 和 图形绘制支持 ---
    #from reportlab.graphics.barcode.pdf417 import Pdf417
    #from reportlab.graphics.barcode import createBarcodeDrawing 
    #from reportlab.graphics.barcode.common import IBarCode
    #from reportlab.graphics import renderPDF
    #from reportlab.lib.units import mm as reportlab_mm
    # ----------------------------------
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    # --- 新增 CID 字体支持 ---
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    # -------------------------
    from PIL import Image
    from PIL import Image
    #from PIL.ImageQt import ImageQt
    import fitz # PyMuPDF
    import serial
    import serial.tools.list_ports
    
    # --- 新增: Windows 打印支持 ---
    import win32api
    import win32print
    # ----------------------------
except ImportError as e:
    print(f"Import Error: {e}")
    pass

# --- Constants ---
PRINTS_DIR = "print"# ✨ 新增：PDF 缓存文件目录
DB_FILE = "database/qsl_manager.db"
LOGBOOK_FILE = "logbook.adi"
STYLE_SHEET_FILE = "assets/style.qss"
CONFIG_FILE = "config.json"
LABELS_DIR = "labels"
ENG_FONT_FILE = "MapleMonoNL-Regular.ttf" # English Font
ZH_FONT_FILE = "Cinese.ttf"              # Chinese Font
MODES_LIST = ["", "AM", "ARDOP", "ATV", "C4FM", "CHIP", "CLO", "CW", "DIGITALVOICE", "DOMINO", "DSTAR", "FAX", "FM", "FSK441", "FT8", "FT4", "HELL", "JT4", "JT6M", "JT9", "JT44", "JT65", "MFSK", "MSK144", "MT63", "OLIVIA", "OPERA", "PACKET", "PAX", "PSK", "PSK2K", "Q15", "QRA64", "ROS", "RTTY", "RTTYM", "SSB", "SSTV", "THOR", "THRB", "V4", "V5", "VOI", "WINMOR", "WSPR", "AMSS", "ASCI", "PCW", "EYEBALL"]
FREQ_BAND_MAP = {
    (1.8, 2.0): "160m", (3.5, 4.0): "80m", (5.0, 5.6): "60m", (7.0, 7.3): "40m",
    (10.1, 10.15): "30m", (14.0, 14.35): "20m", (18.068, 18.168): "17m",
    (21.0, 21.45): "15m", (24.89, 24.99): "12m", (28.0, 29.7): "10m",
    (50, 54): "6m", (144, 148): "2m", (222, 225): "1.25m", (420, 450): "70cm",
    (902, 928): "33cm", (1240, 1300): "23cm",
    (2300, 2450): "13cm",
    (3400, 3500): "9cm",
    (5650, 5850): "5cm",
    (10000, 10500): "3cm",
    (24000, 24250): "1.2cm",
    (47000, 47200): "6mm",
    (76000, 81000): "4mm", # Merged 76-77.5, 77.5-78, 78-81
    (122250, 123000): "2.5mm",
    (134000, 136000): "2mm",
    (241000, 250000): "1mm" # Merged 241-248, 248-250
}


# --- Configuration Manager ---
class ConfigManager:
    @staticmethod
    def load_config():
        default_config = {"primary_callsign": "", "nfc_port": "", "nfc_baudrate": 9600}
        if not os.path.exists(CONFIG_FILE): return default_config
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # Ensure default keys exist
                for key, value in default_config.items():
                    config.setdefault(key, value)
                return config
        except (IOError, json.JSONDecodeError): return default_config

    @staticmethod
    def save_config(config_data):
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE) or '.', exist_ok=True)
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f: json.dump(config_data, f, indent=4)
        except IOError as e: print(f"Error saving config: {e}")

    @staticmethod
    def get_config(key, default=""):
        return ConfigManager.load_config().get(key, default)

    @staticmethod
    def set_config(key, value):
        config = ConfigManager.load_config()
        config[key] = value
        ConfigManager.save_config(config)

# --- ADIF Handler ---
class ADIF_Handler:
    @staticmethod
    def qso_to_adif_record(qso_data: dict) -> str:
        adif_str = ""
        mapping = { 'station_callsign': 'CALL', 'qso_date': 'QSO_DATE', 'time_on': 'TIME_ON', 'band': 'BAND', 'band_rx': 'BAND_RX', 'mode': 'MODE', 'submode': 'SUBMODE', 'rst_sent': 'RST_SENT', 'rst_rcvd': 'RST_RCVD', 'freq': 'FREQ', 'freq_rx': 'FREQ_RX', 'my_callsign': 'OPERATOR', 'comment': 'COMMENT', 'qsl_sent': 'QSL_SENT', 'qsl_rcvd': 'QSL_RCVD', 'sat_name': 'SAT_NAME', 'prop_mode': 'PROP_MODE' }
        for key, adif_tag in mapping.items():
            value = qso_data.get(key)
            if value: adif_str += f"<{adif_tag}:{len(str(value))}>{value} "
        adif_str += "<EOR>\n\n"
        return adif_str

    @staticmethod
    def append_to_logbook(adif_record: str):
        try:
            with open(LOGBOOK_FILE, "a", encoding="utf-8") as f: f.write(adif_record)
        except IOError as e: print(f"Error writing to logbook file: {e}")

# --- New Fixed Layout Printer (Updated for 70x50mm Grid Layout) ---
class NewLayoutPrinter:
    _eng_font = 'Helvetica'
    _zh_font = 'STSong-Light' # Default
    _fonts_registered = False

    @staticmethod
    def _setup_fonts():
        """
        设置 ReportLab 使用的中英文混合字体。
        在 PyInstaller 打包环境下，使用 sys._MEIPASS 查找资源文件路径。
        仅使用基本的 TTFont 和 registerFontFamily 注册，兼容不支持 registerFontAlias 的旧版本。
        """
        # 确定资源文件的基本路径 (PyInstaller 兼容性)
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.path.dirname(os.path.abspath(__file__))

        ENGLISH_FONT_FILE = "MapleMonoNL-Regular.ttf"
        CHINESE_FONT_FILE = "Cinese.ttf"
        
        # 保持英文字体名称
        FONT_NAME_EN = "MapleMono-Regular"
        
        # 中文字体使用自定义名称
        FONT_NAME_ZH = "Custom-Chinese-Font"

        en_font_path = os.path.join(base_path, ENGLISH_FONT_FILE)
        zh_font_path = os.path.join(base_path, CHINESE_FONT_FILE)

        # 1. 注册英文字体
        try:
            pdfmetrics.registerFont(TTFont(FONT_NAME_EN, en_font_path))
        except Exception as e:
            print(f"Error registering English font: {e}")
            FONT_NAME_EN = 'Helvetica'

        # 2. 注册中文字体 (仅使用基础注册方法)
        try:
            # A. 注册 TTF 文件
            pdfmetrics.registerFont(TTFont(FONT_NAME_ZH, zh_font_path))
            
            # B. 注册字体家族 (Font Family)
            pdfmetrics.registerFontFamily(FONT_NAME_ZH, normal=FONT_NAME_ZH)
            
            # --- 注意：已移除所有 pdfmetrics.registerFontAlias 的调用 ---
            
        except Exception as e:
            print(f"Error registering Chinese font: {e}")
            # 如果注册失败，回退到英文字体
            FONT_NAME_ZH = FONT_NAME_EN 

        return FONT_NAME_EN, FONT_NAME_ZH
    @staticmethod
    def _print_file(file_path):
        """触发Windows默认打印机打印文件"""
        try:
            # 使用 ShellExecute 调用关联的程序打印 (通常是默认的PDF阅读器)
            win32api.ShellExecute(0, "print", file_path, None, ".", 0)
        except Exception as e:
            print(f"Printing Error: {e}")
            # 如果 ShellExecute 失败，尝试直接提示用户
            try:
                os.startfile(file_path, "print")
            except Exception as ex:
                print(f"os.startfile failed: {ex}")

    @staticmethod
    def _draw_mixed_string(c, x, y, text, fonts, size, align='left'):
        """支持中文混排的绘制函数"""
        eng_font, zh_font = fonts
        if not text: text = ""
        text = str(text)
        
        # 计算总宽度用于居中
        total_width = 0
        segments = re.findall(r'([\u4e00-\u9fff]+|[^\u4e00-\u9fff]+)', text)
        if align == 'center':
            for segment in segments:
                is_chinese = '\u4e00' <= segment[0] <= '\u9fff'
                font_to_use = zh_font if is_chinese else eng_font
                total_width += pdfmetrics.stringWidth(segment, font_to_use, size)
            cursor_x = x - (total_width / 2)
        else:
            cursor_x = x

        for segment in segments:
            is_chinese = '\u4e00' <= segment[0] <= '\u9fff'
            font_to_use = zh_font if is_chinese else eng_font
            c.setFont(font_to_use, size)
            c.drawString(cursor_x, y, segment)
            cursor_x += c.stringWidth(segment, font_to_use, size)
    @staticmethod
    def _get_pixmap_from_pdf(pdf_buffer):
        """
        使用 PyMuPDF (fitz) 从 BytesIO 缓冲区中加载 PDF 并渲染为 PIL 图像。
        """
        try:
            # 使用 fitz.open 从 BytesIO 打开 PDF
            pdf_buffer.seek(0)
            doc = fitz.open("pdf", pdf_buffer.read())
            if not doc or doc.page_count == 0:
                print("Error: PDF buffer is empty or invalid.")
                return None
            
            # 渲染第一页
            page = doc.load_page(0)
            # 设置分辨率（例如 300 DPI）
            zoom_x = 300 / 72  # 72 points per inch is standard PDF resolution
            zoom_y = 300 / 72
            matrix = fitz.Matrix(zoom_x, zoom_y)
            
            # 获取像素图
            pix = page.get_pixmap(matrix=matrix)
            doc.close()

            # 将 fitz.Pixmap 转换为 PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            return img

        except Exception as e:
            print(f"Error rendering PDF to image: {e}")
            import traceback
            traceback.print_exc()
            return None

    @staticmethod
    def _render_and_output_as_png(qsl_id, pdf_buffer, parent_widget):
        """
        将 PDF 渲染成 PNG 图像用于界面预览。
        """
        try:
            img = NewLayoutPrinter._get_pixmap_from_pdf(pdf_buffer)
            if img:
                # 1. 临时保存 PNG (可选，用于调试)
                png_path = os.path.join(LABELS_DIR, f"{qsl_id}.png")
                img.save(png_path)

                # 2. 将 PIL Image 存储到父窗口或用于预览
                # 假设父窗口有一个方法来接收预览图，例如：
                if hasattr(parent_widget, 'display_qsl_preview'):
                    q_img = ImageQt(img)
                    pixmap = QPixmap.fromImage(q_img)
                    parent_widget.display_qsl_preview(pixmap)
                
                print(f"Preview PNG saved to: {png_path}")

        except Exception as e:
            print(f"Failed to generate PNG preview: {e}")

    @staticmethod
    def generate_layout_1(qsl_id, log_data_list, parent_widget):
        """
        生成 70mm x 50mm 标签。
        1-N页：6x6 网格布局的 QSO 数据。
        最后一页：独立的 QSL ID 和 居中二维码（用于贴信封）。
        """
        os.makedirs(LABELS_DIR, exist_ok=True)
        os.makedirs(PRINTS_DIR, exist_ok=True)
        pdf_buffer = BytesIO()
        
        # -----------------------------------------------------------------
        # 【QR Code 手动调节变量区域】
        # -----------------------------------------------------------------
        # 1. QR Code 容错率 (L, M, Q, H) - H为最高容错
        QR_ERROR_CORRECTION = qrcode.constants.ERROR_CORRECT_H
        # 2. QR Code 尺寸 (ReportLab mm) - 推荐不超过 10mm
        QR_SIZE_MM = 10 * mm
        # 3. QR Code 框的大小系数 (影响像素密度，不推荐修改)
        QR_BOX_SIZE = 10 
        # 4. QR Code 边框大小 (0为无边框，最小化尺寸)
        QR_BORDER = 0
        # 5. 二维码垂直偏移量 (正值向上移动，负值向下移动)
        QR_Y_OFFSET_MM = 17 * mm # 建议从 1.5mm 开始测试
        # -----------------------------------------------------------------
        # 【最后一页专属：二维码手动调节变量区域】
        # -----------------------------------------------------------------
        QR_PAGE_SIZE_MM = 35 * mm  # 最后一页二维码的尺寸（默认35mm，可调）
        QR_PAGE_FONT_SIZE = 12     # 最后一页 QSL ID 的字体大小
        QR_PAGE_Y_OFFSET = 5 * mm  # 二维码整体上下偏移（正值向上）
        # -----------------------------------------------------------------

        L_WIDTH, L_HEIGHT = 70 * mm, 50 * mm
        ROWS, COLS = 6, 6
        col_w = L_WIDTH / COLS
        row_h = L_HEIGHT / ROWS
        half_row_h = row_h / 2

        try:
            fonts = NewLayoutPrinter._setup_fonts()
            c = canvas.Canvas(pdf_buffer, pagesize=(L_WIDTH, L_HEIGHT))
            
            # --- 第一部分：生成 QSO 数据页 ---
            logs_per_page = 4
            log_chunks = [log_data_list[i:i + logs_per_page] for i in range(0, len(log_data_list), logs_per_page)]

            for page_num, chunk in enumerate(log_chunks):
                # 获取第一条日志用于头部信息
                first_log = dict(chunk[0]) 
                to_radio = str(first_log.get('station_callsign') or '')

                # 辅助函数：获取单元格中心坐标 (Grid: 0,0 is Top-Left)
                def get_cell_center(r, c_idx, sub_row=None):
                    """
                    r: 行索引 (0-5)
                    c_idx: 列索引 (0-5)
                    sub_row: 0 for upper half, 1 for lower half (Only for rows 2-5)
                    """
                    
                    if sub_row is None or r < 2 or r > 5:
                        # 正常单元格（行 0, 1）
                        x = (c_idx * col_w) + (col_w / 2)
                        y = L_HEIGHT - (r * row_h) - (row_h / 2) - 1*mm 
                    else:
                        # 分割单元格（行 2-5）
                        x = (c_idx * col_w) + (col_w / 2)
                        
                        # 计算当前行 (r) 的底部 ReportLab 坐标
                        y_bottom = L_HEIGHT - ((r + 1) * row_h) 
                        
                        if sub_row == 0: # 上半部分 (Upper)
                            # y 轴中心点: y_bottom + 1.5 * half_row_h
                            y = y_bottom + 1.5 * half_row_h - 1*mm # Visual adjustment
                        else: # 下半部分 (Lower)
                            # y 轴中心点: y_bottom + 0.5 * half_row_h
                            y = y_bottom + 0.5 * half_row_h - 1*mm # Visual adjustment
                            
                    return x, y
                
                # --- 第二行左侧对齐点：Col 0 的中心位置 ---
                QSO_LINE2_ALIGN_X = 0.5 * col_w

                # --- Row 0: Header ---
                
                # 绘制 To Radio 固定文本 (放大字体)
                header_text = "To Radio:"
                header_font_size = 14 # 固定文字使用 12pt
                
                # 绘制对方呼号 <His call> (较小字体)
                callsign_text = str(to_radio)
                callsign_font_size = 10 # 呼号使用 10pt
                
                # 1. 绘制固定文本 "To Radio : " (左对齐)
                start_x = 2*mm
                start_y = L_HEIGHT - row_h + 2.5*mm
                
                NewLayoutPrinter._draw_mixed_string(c, start_x, start_y, header_text, fonts, header_font_size, align='left')
                
                # 2. 计算固定文本的宽度，以便从其后开始绘制呼号
                header_width = pdfmetrics.stringWidth(header_text, fonts[0], header_font_size) 
                callsign_x = start_x + header_width
                
                # 3. 绘制呼号
                NewLayoutPrinter._draw_mixed_string(c, callsign_x, start_y, callsign_text, fonts, callsign_font_size, align='left')

                # 绘制 PSE QSL TNX
                # Col 4-5
                cx_pse, cy_pse = get_cell_center(0, 4.5) 
                NewLayoutPrinter._draw_mixed_string(c, cx_pse, cy_pse, "PSE QSL TNX", fonts, 7, align='center')

                # --- Row 1: Columns Headers ---
                headers = ["Date", "UTC", "RST", "MHz", "Mode"]
                header_cols = [0, 1, 2, 3, 4]
                
                for col_idx, text in zip(header_cols, headers):
                    cx, cy = get_cell_center(1, col_idx)
                    NewLayoutPrinter._draw_mixed_string(c, cx, cy, text, fonts, 7, align='center')
                
                # 画一条横线在表头下方
                line_y = L_HEIGHT - (2 * row_h)
                c.setLineWidth(0.5)
                # 线条只延伸到 Col 5 的左边界，避免穿过 QR Code
                c.line(1*mm, line_y, 5 * col_w, line_y) 

                # --- Rows 2~5: QSO Data (Split Rows) ---
                for i, log_row in enumerate(chunk):
                    current_grid_row = 2 + i # Start from Row 2 (QSO 1)
                    if current_grid_row > 5: break

                    log = dict(log_row)
                    
                    # ----------------------------------------------------
                    # A. 上半部分 (sub_row=0): 原始 QSO 信息 + 频率判定
                    # ----------------------------------------------------
                    
                    # Date Formatting
                    date_str = log.get('qso_date')
                    try:
                        d_obj = datetime.datetime.strptime(date_str, '%Y%m%d')
                        formatted_date = f"{d_obj.day}.{d_obj.month}.{d_obj.year}"[-10:] # Short format
                    except: 
                        formatted_date = date_str

                    # 基础数据列 (Date, UTC, RST, Mode)
                    base_row_data = [
                        formatted_date,
                        str(log.get('time_on') or '')[:4],
                        str(log.get('rst_rcvd') or ''),
                        str(log.get('mode') or '')[:7] 
                    ]
                    base_cols = [0, 1, 2, 4] # 跳过 MHz 列 (Col 3)

                    for col_idx, text in zip(base_cols, base_row_data):
                        cx, cy = get_cell_center(current_grid_row, col_idx, sub_row=0)
                        font_size = 6
                        if len(text) > 7: font_size = 5 # Auto shrink
                        NewLayoutPrinter._draw_mixed_string(c, cx, cy, text, fonts, font_size, align='center')

                    # 频率 (MHz) 判定逻辑 (Col 3)
                    freq_display = ""
                    if log.get('sat_name'):
                        try:
                            # 卫星频率判定逻辑
                            freq_rx = float(log.get('freq_rx') or 0)
                            freq_tx = float(log.get('freq') or 0)
                            
                            if 400 < freq_rx < 500 and 140 < freq_tx < 150: freq_display = "145/435"
                            elif 140 < freq_rx < 150 and 400 < freq_tx < 500: freq_display = "435/145"
                            elif 400 < freq_rx < 500 and 400 < freq_tx < 500: freq_display = "435/435"
                            elif 140 < freq_rx < 150 and 140 < freq_tx < 150: freq_display = "145/145"
                            else: freq_display = f"{str(log.get('freq') or '')}/{str(log.get('freq_rx') or '')}"
                            
                        except: 
                            freq_display = f"{str(log.get('freq') or '')}/{str(log.get('freq_rx') or '')}"
                            
                    elif log.get('mode') == 'EYEBALL':
                        freq_display = "N/A"
                    else:
                        freq_display = str(log.get('freq') or '')[:7]

                    cx, cy = get_cell_center(current_grid_row, 3, sub_row=0) # Col 3
                    NewLayoutPrinter._draw_mixed_string(c, cx, cy, freq_display, fonts, 7, align='center')
                    
                    # ----------------------------------------------------
                    # B. 下半部分 (sub_row=1): 备注及卫星信息
                    # ----------------------------------------------------
                    cy_bottom = get_cell_center(current_grid_row, 0, sub_row=1)[1]
                    
                    # 1. 备注信息 (左侧)
                    comment = str(log.get('comment') or '')
                    comment_text = ""
                    
                    if comment:
                        comment_text = f"备注: {comment[:25]}"
                    
                    # 2. 卫星/类型信息 (右侧)
                    info_text = ""
                    if log.get('sat_name'):
                        info_text = f"Satellite: via {log.get('sat_name')}"
                    elif log.get('mode') == 'EYEBALL':
                        info_text = f"Type: {str(log.get('submode') or '')}"
                        
                    # 绘制备注 (左侧) - 对齐到 Col 0 中心
                    if comment_text:
                        NewLayoutPrinter._draw_mixed_string(c, QSO_LINE2_ALIGN_X, cy_bottom, comment_text, fonts, 6, align='left')
                        
                        # 卫星信息在备注右侧，留出间距
                        comment_width = pdfmetrics.stringWidth(comment_text, fonts[1], 6) 
                        cx_info = QSO_LINE2_ALIGN_X + comment_width + 3*mm # 3mm 间距
                        NewLayoutPrinter._draw_mixed_string(c, cx_info, cy_bottom, info_text, fonts, 6, align='left')
                    else:
                         # 如果没有备注，则卫星信息从 Col 0 中心开始
                        NewLayoutPrinter._draw_mixed_string(c, QSO_LINE2_ALIGN_X, cy_bottom, info_text, fonts, 6, align='left')
                        
                    # ----------------------------------------------------
                    # C. 绘制水平分隔线 (仅在 Row 2, 3, 4 底部绘制)
                    # ----------------------------------------------------
                    # 确保不绘制最底下一根分割线 (current_grid_row = 5)
                    if current_grid_row < 5: 
                        line_y_qso = L_HEIGHT - ((current_grid_row + 1) * row_h)
                        c.setLineWidth(0.2)
                        
                        # 线条只延伸到 Col 5 的左边界 (即 5*col_w)
                        line_end_x = 5 * col_w
                        c.line(1*mm, line_y_qso, line_end_x, line_y_qso)

                # --- 移除垂直分割线：二维码现在占据了 Col 5 的大部分，不需要垂直线 ---

                # --- NEW: Col 5, Rows 1-5: QR Code 区域 ---
                
                # 1. 定义区域坐标 (Grid: (1,5) to (5,5))
                qr_area_x_start = 5 * col_w
                qr_area_y_bottom = L_HEIGHT - (6 * row_h) # Bottom edge of Row 5
                qr_area_y_top = L_HEIGHT - (1 * row_h)   # Top edge of Row 1
                
                qr_area_width = col_w
                qr_area_height = 5 * row_h

                # 2. 计算区域中心点
                center_x = qr_area_x_start + (qr_area_width / 2)
                # [修改行] 使用偏移量 QR_Y_OFFSET_MM (正值向上)
                center_y = qr_area_y_bottom + (qr_area_height / 2) + QR_Y_OFFSET_MM

                # 3. 确定二维码绘制尺寸 (使用定义的变量)
                qr_size_mm = min(QR_SIZE_MM, qr_area_height - 2*mm, qr_area_width - 2*mm) # 留出 2mm 边距
                
                # 4. 生成 QR Code Image (使用定义的变量)
                qr = qrcode.QRCode(
                    version=None,
                    error_correction=QR_ERROR_CORRECTION, 
                    box_size=QR_BOX_SIZE, 
                    border=QR_BORDER,
                )
                qr.add_data(qsl_id)
                qr.make(fit=True)
                
                img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

                # 5. 转换为 ReportLab 可读格式 (BytesIO -> ImageReader)
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                qr_image_reader = ImageReader(img_buffer)

                # 6. 计算绘制起点 (bottom-left corner) 以居中
                draw_x = center_x - (qr_size_mm / 2)
                draw_y = center_y - (qr_size_mm / 2)

                # 7. 绘制 QR Code
                c.drawImage(qr_image_reader, draw_x, draw_y, width=qr_size_mm, height=qr_size_mm)

                c.showPage()
            # --- 第二部分：生成额外的一页（QSL ID + 二维码） ---
            # 1. 生成二维码图像
            qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=0)
            qr.add_data(qsl_id)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
            img_buffer = BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            qr_image_reader = ImageReader(img_buffer)

            # 2. 计算中心位置
            center_x = L_WIDTH / 2
            center_y = L_HEIGHT / 2 + QR_PAGE_Y_OFFSET
            
            # 3. 绘制二维码
            draw_x = center_x - (QR_PAGE_SIZE_MM / 2)
            draw_y = center_y - (QR_PAGE_SIZE_MM / 2)
            c.drawImage(qr_image_reader, draw_x, draw_y, width=QR_PAGE_SIZE_MM, height=QR_PAGE_SIZE_MM)
            
            # 4. 绘制 ID 文本 (居中在二维码下方)
            text_y = draw_y + QR_PAGE_SIZE_MM - 45*mm
            NewLayoutPrinter._draw_mixed_string(c, center_x, text_y, f"{qsl_id}", fonts, QR_PAGE_FONT_SIZE, align='center')
            
            c.showPage() # 结束二维码页

            # --- 保存与打印 ---
            c.save()
            QMessageBox.information(parent_widget, "生成成功", f"已生成 QSL ID/二维码标签（收卡）：{qsl_id}")
            
            NewLayoutPrinter._render_and_output_as_png(qsl_id, pdf_buffer, parent_widget)
            temp_pdf_path = os.path.join(PRINTS_DIR, f"{qsl_id}.pdf")
            with open(temp_pdf_path, "wb") as f:
                f.write(pdf_buffer.getvalue()) 
            NewLayoutPrinter._print_file(temp_pdf_path)

        except Exception as e:
            QMessageBox.critical(parent_widget, "生成失败", f"生成出错: {e}")
            import traceback
            traceback.print_exc()
    
    @staticmethod
    def generate_layout_2(qsl_id, log_data_list, parent_widget):
        """
        生成 70mm x 50mm 标签（收卡标签）。
        仅生成 QSL ID 二维码页。
        （此方法内容复制自原 generate_layout_1 中的第二页逻辑）
        """
        os.makedirs(PRINTS_DIR, exist_ok=True)
        pdf_buffer = BytesIO()
        
        # 尺寸和常量定义（与 layout_1 的第二页保持一致）
        L_WIDTH, L_HEIGHT = 70 * mm, 50 * mm
        QR_PAGE_SIZE_MM = 35 * mm  # 二维码的尺寸 (较大)
        QR_PAGE_FONT_SIZE = 12     # QSL ID 的字体大小
        QR_PAGE_Y_OFFSET = 5 * mm  # 二维码整体上下偏移（正值向上）
        
        try:
            fonts = NewLayoutPrinter._setup_fonts()
            c = canvas.Canvas(pdf_buffer, pagesize=(L_WIDTH, L_HEIGHT))

            # --- QSL ID + 二维码 页 (Page 1) ---
            
            # 1. 生成二维码图像
            # 使用高容错率 (H)
            qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=0)
            qr.add_data(qsl_id)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
            img_buffer = BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            qr_image_reader = ImageReader(img_buffer)

            # 2. 计算中心位置
            center_x = L_WIDTH / 2
            center_y = L_HEIGHT / 2 + QR_PAGE_Y_OFFSET
            
            # 3. 绘制二维码
            draw_x = center_x - (QR_PAGE_SIZE_MM / 2)
            draw_y = center_y - (QR_PAGE_SIZE_MM / 2)
            c.drawImage(qr_image_reader, draw_x, draw_y, width=QR_PAGE_SIZE_MM, height=QR_PAGE_SIZE_MM)
            
            # 4. 绘制 ID 文本 (居中在二维码下方)
            text_y = center_y + (QR_PAGE_SIZE_MM / 2) - 45*mm
            NewLayoutPrinter._draw_mixed_string(c, center_x, text_y, f"{qsl_id}", fonts, QR_PAGE_FONT_SIZE, align='center')
            
            c.showPage() # 结束二维码页

            # --- 保存与打印 ---
            c.save()
            # 更改提示信息和文件名后缀，用于收卡区分
            QMessageBox.information(parent_widget, "收卡标签生成成功", f"已生成 QSL ID/二维码标签（收卡）：{qsl_id}")
            
            # 渲染预览图
            NewLayoutPrinter._render_and_output_as_png(f"{qsl_id}", pdf_buffer, parent_widget)
            
            # 临时保存 PDF 并打印
            temp_pdf_path = os.path.join(PRINTS_DIR, f"{qsl_id}.pdf")
            with open(temp_pdf_path, "wb") as f:
                f.write(pdf_buffer.getvalue()) 
            NewLayoutPrinter._print_file(temp_pdf_path)

        except Exception as e:
            QMessageBox.critical(parent_widget, "收卡标签生成失败", f"生成出错: {e}")
            import traceback
            traceback.print_exc()
    
    # --- [REPLACE generate_address_label METHOD in NewLayoutPrinter] ---
    @staticmethod
    def generate_address_label(sender_info, receiver_info, parent_widget):
        """
        生成 70mm x 50mm 地址标签 (分页显示：P1发件人，P2收件人)
        特性：支持管道符(|)强制换行；无管道符时，启用核心行政词 + 16字长度限制自适应换行。
        顶部增加 FROM:/TO: 标题，并增加顶部间距。
        """
        ADDRESS_DIR = "address"
        os.makedirs(ADDRESS_DIR, exist_ok=True)
        
        filename_id = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        pdf_buffer = BytesIO()
        
        # 尺寸定义
        L_WIDTH, L_HEIGHT = 70 * mm, 50 * mm
        MARGIN = 3 * mm
        
        # --- 地址智能分行函数 (逻辑保持不变) ---
        def smart_split_address(raw_addr):
            if '|' in raw_addr:
                return [line.strip() for line in raw_addr.split('|') if line.strip()]

            lines = []
            current_line = ""
            CORE_KEYWORDS = ['省', '市', '州', '县', '区'] 
            MAX_LEN = 16 
            MIN_LEN_FOR_KEYWORD_BREAK = 5 

            raw_addr = raw_addr.replace(' ', '').replace('\t', '')
            
            i = 0
            while i < len(raw_addr):
                char = raw_addr[i]
                current_line += char
                i += 1
                
                current_len = len(current_line)

                # 规则 A: 关键词触发的换行
                if current_len >= MIN_LEN_FOR_KEYWORD_BREAK:
                    is_keyword_end = False
                    for kw in CORE_KEYWORDS:
                        if current_line.endswith(kw):
                            is_keyword_end = True
                            break
                    
                    if is_keyword_end:
                        lines.append(current_line)
                        current_line = ""
                        continue

                # 规则 B: 长度强制截断
                if current_len >= MAX_LEN:
                    lines.append(current_line[:MAX_LEN])
                    current_line = current_line[MAX_LEN:]
                    # 确保索引 i 正确处理了剩余部分
                    i = i - len(current_line) 

            if current_line:
                lines.append(current_line)
                
            return [line for line in lines if line]
        # --- 结束：地址智能分行函数 ---


        try:
            fonts = NewLayoutPrinter._setup_fonts()
            c = canvas.Canvas(pdf_buffer, pagesize=(L_WIDTH, L_HEIGHT))
            import re # 确保 re 库被导入

            def draw_single_label(info_dict, role_suffix):
                FONT_SIZE_TITLE = 12 
                FONT_SIZE_NORMAL = 10
                FONT_SIZE_LARGE = 12
                LINE_SPACING = 5 * mm
                
                # --- 关键修改：增加顶部间距 ---
                # 设定顶部文字基线距离标签顶部边缘 8 mm (原约为 6mm)
                TOP_SPACE_FROM_EDGE = 8 * mm 
                current_y = L_HEIGHT - TOP_SPACE_FROM_EDGE
                
                # --- 标题行 ---
                if role_suffix == "发":
                    title_text = "FROM(发自):"
                else: 
                    title_text = "TO(发往):"
                    
                NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, title_text, fonts, FONT_SIZE_TITLE, align='left')
                current_y -= LINE_SPACING # 标题占一行空间

                # 1. 邮编 (Zip) 
                zip_text = f"{info_dict.get('zip', '')}"
                NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, zip_text, fonts, FONT_SIZE_NORMAL, align='left')
                current_y -= LINE_SPACING

                # 2. 地址 (Address) - 调用智能分行
                final_lines = smart_split_address(info_dict.get('address', ''))
                
                # 绘制地址行
                for line in final_lines:
                    if current_y < 15 * mm: break # 防止覆盖底部信息
                    NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, line, fonts, FONT_SIZE_NORMAL, align='left')
                    current_y -= (LINE_SPACING * 0.9)

                current_y -= 1 * mm # 地址与姓名的间距

                # 3. 姓名 (Name) + (收/发)
                name_text = f"{info_dict.get('name', '')} "
                NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, name_text, fonts, FONT_SIZE_LARGE, align='left')
                current_y -= LINE_SPACING

                # 4. 电话 (Phone)
                phone_text = info_dict.get('phone', '')
                if phone_text:
                    phone_text = f"TEL: {phone_text}"
                    NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, phone_text, fonts, FONT_SIZE_NORMAL, align='left')
                    current_y -= LINE_SPACING

                # 5. 国家 (Country)
                country_text = info_dict.get('country', '')
                if country_text:
                    NewLayoutPrinter._draw_mixed_string(c, MARGIN, current_y, country_text, fonts, FONT_SIZE_LARGE, align='left')

            # --- 绘制 P1: 发件人 ---
            draw_single_label(sender_info, "发")
            c.showPage()

            # --- 绘制 P2: 收件人 ---
            draw_single_label(receiver_info, "收")
            c.showPage()

            c.save()

            # --- 输出与打印 ---
            final_pdf_path = os.path.join(ADDRESS_DIR, f"addr_{filename_id}.pdf")
            with open(final_pdf_path, "wb") as f:
                f.write(pdf_buffer.getvalue())
            
            NewLayoutPrinter._print_file(final_pdf_path)
            
            return True

        except Exception as e:
            QMessageBox.critical(parent_widget, "生成失败", f"生成地址标签时出错: {e}")
            import traceback
            traceback.print_exc()
            return False
    
# --- NFC Writer Class ---
class NFCWriter:
    @staticmethod
    def get_available_ports():
        """Returns a list of available serial ports."""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]

    @staticmethod
    def write_to_port(port, baudrate, data, parent):
        """Tries to write data to the specified serial port with a newline character."""
        try:
            with serial.Serial(port, baudrate, timeout=1) as ser:
                # Append a newline character to simulate pressing Enter
                ser.write((data + '\n').encode('utf-8'))
                QMessageBox.information(parent, "成功", f"已成功将数据 '{data}' (并附加回车) 发送到端口 {port}。")
                return True
        except serial.SerialException as e:
            QMessageBox.critical(parent, "写入失败", f"无法打开或写入串口 {port}。\n错误: {e}")
            return False

# --- Dialogs ---
class NfcWriteDialog(QDialog):
    """Dialog for writing a QSL ID to an NFC card via serial port."""
    def __init__(self, qsl_id, parent=None):
        super().__init__(parent)
        self.qsl_id = qsl_id
        self.setWindowTitle("写入NFC卡")
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setMinimumWidth(400)

        layout = QFormLayout(self)
        
        self.qsl_id_label = QLabel(self.qsl_id)
        self.qsl_id_label.setStyleSheet("font-weight: bold; color: #f1c40f;")
        
        self.port_combo = QComboBox()
        self.baudrate_combo = QComboBox()
        self.baudrate_combo.addItems(['9600', '19200', '38400', '57600', '115200'])
        
        self.refresh_button = QPushButton("刷新端口")
        self.refresh_button.clicked.connect(self.populate_ports)
        
        port_layout = QHBoxLayout()
        port_layout.addWidget(self.port_combo, 1)
        port_layout.addWidget(self.refresh_button)

        layout.addRow("QSL卡号:", self.qsl_id_label)
        layout.addRow("串口:", port_layout)
        layout.addRow("波特率:", self.baudrate_combo)
        
        self.button_box = QDialogButtonBox()
        self.write_button = self.button_box.addButton("写入", QDialogButtonBox.AcceptRole)
        self.button_box.addButton(QDialogButtonBox.Cancel)
        
        layout.addRow(self.button_box)

        self.write_button.clicked.connect(self.perform_write)
        self.button_box.rejected.connect(self.reject)
        
        self.populate_ports()
        self.load_saved_settings()
        
    def populate_ports(self):
        self.port_combo.clear()
        ports = NFCWriter.get_available_ports()
        if not ports:
            self.port_combo.addItem("未找到串口")
            self.write_button.setEnabled(False)
        else:
            self.port_combo.addItems(ports)
            self.write_button.setEnabled(True)

    def load_saved_settings(self):
        saved_port = ConfigManager.get_config("nfc_port")
        saved_baudrate = str(ConfigManager.get_config("nfc_baudrate", 9600))
        
        if saved_port and self.port_combo.findText(saved_port) != -1:
            self.port_combo.setCurrentText(saved_port)
            
        if saved_baudrate and self.baudrate_combo.findText(saved_baudrate) != -1:
            self.baudrate_combo.setCurrentText(saved_baudrate)

    def perform_write(self):
        port = self.port_combo.currentText()
        baudrate = int(self.baudrate_combo.currentText())
        
        if port == "未找到串口":
            QMessageBox.warning(self, "无端口", "请先连接串口设备并刷新端口列表。")
            return
            
        ConfigManager.set_config("nfc_port", port)
        ConfigManager.set_config("nfc_baudrate", baudrate)

        if NFCWriter.write_to_port(port, baudrate, self.qsl_id, self):
            self.accept()

class QSLInventoryUpdateDialog(QDialog):
    """
    用于批量/快速更新卡片收发日期的对话框。
    """
    def __init__(self, db_manager, parent=None):
        super().__init__(parent)
        self.db_manager = db_manager
        self.setWindowTitle("QSL卡片出入库更新")
        # 禁用问号帮助按钮和尺寸调整
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint) 
        self.setFixedSize(1500, 400)

        main_layout = QVBoxLayout(self)
        
        info_label = QLabel("请输入QSL卡片ID并按回车（或回车设备扫码）更新收/发卡日期为当前日期：")
        main_layout.addWidget(info_label)

        self.qsl_id_input = QLineEdit()
        self.qsl_id_input.setPlaceholderText("输入QSL ID 后回车")
        # 核心逻辑：输入完成（回车或焦点丢失）时触发处理
        self.qsl_id_input.editingFinished.connect(self.process_qsl_id)
        self.qsl_id_input.setFont(QFont("Arial", 14))
        main_layout.addWidget(self.qsl_id_input)

        self.status_label = QLabel("状态: 等待输入...")
        self.status_label.setStyleSheet("font-weight: bold; color: #3498db;")
        main_layout.addWidget(self.status_label)
        
        # 确保输入框获得焦点，方便连续操作
        self.qsl_id_input.setFocus()

    def process_qsl_id(self):
        """处理输入框中的QSL ID，执行数据库更新。"""
        qsl_id = self.qsl_id_input.text().strip().upper()
        self.qsl_id_input.clear() # 立即清空输入框，准备下一次输入/扫描
        
        if not qsl_id:
            self.status_label.setText("状态: ID为空，请重新输入。")
            self.status_label.setStyleSheet("color: #e67e22;")
            # 重新获得焦点
            self.qsl_id_input.setFocus()
            return

        self.status_label.setText(f"状态: 正在处理 ID: {qsl_id}...")
        self.status_label.setStyleSheet("color: #f1c40f;")
        
        # 调用数据库方法执行更新
        success, message = self.db_manager.update_qsl_card_date(qsl_id)
        
        # 更新状态标签
        if success:
            self.status_label.setText(f"✅ 成功! ID: {qsl_id} - {message}")
            self.status_label.setStyleSheet("font-weight: bold; color: #2ecc71;")
            # 通知主窗口更新仪表板统计数据
            if hasattr(self.parent(), 'update_dashboard_stats'):
                self.parent().update_dashboard_stats()
        else:
            self.status_label.setText(f"❌ 失败! ID: {qsl_id} - {message}")
            self.status_label.setStyleSheet("font-weight: bold; color: #e74c3c;")
            
        # 重新获得焦点，等待下一个 QSL ID
        self.qsl_id_input.setFocus()

class BatchQslModeDialog(QDialog):
    def __init__(self, log_count, parent=None):
        super().__init__(parent)
        self.setWindowTitle("选择卡片模式")
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setFixedSize(700, 240)
        self.mode = None
        layout = QVBoxLayout(self); layout.addWidget(QLabel(f"您选择了 {log_count} 条日志，请选择处理模式："))
        self.multi_card_button = QPushButton("多卡模式 (为每条日志生成独立卡号)")
        self.single_card_button = QPushButton("单卡模式 (为所有日志生成一个卡号)")
        self.multi_card_button.clicked.connect(self.select_multi_card); self.single_card_button.clicked.connect(self.select_single_card)
        layout.addWidget(self.multi_card_button); layout.addWidget(self.single_card_button)
    def select_multi_card(self): self.mode = "multi"; self.accept()
    def select_single_card(self): self.mode = "single"; self.accept()

class CardActionDialog(QDialog):
    def __init__(self, title, cards, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setFixedSize(700, 240)
        self.selected_card_info = None
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("请选择要操作的卡片："))

        rc_card = next((c for c in cards if c['direction'] == 'RC'), None)
        tc_card = next((c for c in cards if c['direction'] == 'TC'), None)

        self.rc_button = QPushButton(f"收卡 (RC): {rc_card['qsl_id'] if rc_card else '无'}")
        self.rc_button.setEnabled(rc_card is not None)
        self.rc_button.clicked.connect(lambda: self.select_card(rc_card))

        self.tc_button = QPushButton(f"发卡 (TC): {tc_card['qsl_id'] if tc_card else '无'}")
        self.tc_button.setEnabled(tc_card is not None)
        self.tc_button.clicked.connect(lambda: self.select_card(tc_card))

        layout.addWidget(self.rc_button); layout.addWidget(self.tc_button)

    def select_card(self, card_info):
        self.selected_card_info = card_info
        self.accept()

class SettingsDialog(QDialog):
    data_changed = pyqtSignal()
    def __init__(self, db_manager, parent=None):
        super().__init__(parent)
        self.db_manager = db_manager; self.setWindowTitle("设置")
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setMinimumSize(1000, 600)
        main_layout = QVBoxLayout(self)
        
        # Callsign Settings
        callsign_frame = QGroupBox("呼号管理"); callsign_layout = QVBoxLayout(callsign_frame)
        self.callsign_list = QListWidget()
        callsign_layout.addWidget(self.callsign_list)
        btn_layout = QHBoxLayout(); self.add_btn = QPushButton("添加新呼号"); self.del_btn = QPushButton("删除选中呼号"); self.set_primary_btn = QPushButton("设为主要呼号")
        btn_layout.addWidget(self.add_btn); btn_layout.addWidget(self.del_btn); btn_layout.addWidget(self.set_primary_btn)
        callsign_layout.addLayout(btn_layout)
        main_layout.addWidget(callsign_frame)

        # Danger Zone
        danger_zone = QGroupBox("危险区域"); danger_layout = QVBoxLayout(danger_zone)
        self.reset_data_btn = QPushButton("重置全部卡片数据"); self.reset_data_btn.setStyleSheet("background-color: #c0392b;")
        danger_layout.addWidget(self.reset_data_btn)
        main_layout.addWidget(danger_zone)

        main_layout.addStretch()
        self.close_button = QDialogButtonBox(QDialogButtonBox.Close); main_layout.addWidget(self.close_button)

        # Connections
        self.add_btn.clicked.connect(self.add_callsign); self.del_btn.clicked.connect(self.delete_callsign)
        self.set_primary_btn.clicked.connect(self.set_primary)
        self.reset_data_btn.clicked.connect(self.handle_reset_data)
        self.close_button.rejected.connect(self.reject)
        
        self.load_settings()

    def load_settings(self):
        # Load callsign settings
        self.callsign_list.clear(); primary_callsign = ConfigManager.get_config("primary_callsign"); callsigns = self.db_manager.get_all_my_callsigns()
        for callsign in callsigns:
            self.callsign_list.addItem(callsign)
            if callsign == primary_callsign: 
                try:
                    item = self.callsign_list.findItems(callsign, Qt.MatchExactly)[0]
                    item.setFont(QFont("Arial", 12, QFont.Bold)); item.setForeground(Qt.yellow)
                except IndexError:
                    pass # Should not happen if callsign exists

    def handle_reset_data(self):
        reply = QMessageBox.question(self, "危险操作确认", "您确定要重置所有QSL卡片数据吗？\n\n此操作将 **永久删除** 所有已生成的卡号和出入库记录，并将所有日志状态重置为未收/发。\n\n**此操作不可恢复！**", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No: return

        password, ok = QInputDialog.getText(self, "密码确认", "请输入密码 'admin' 以确认操作:", QLineEdit.Password)
        if ok and password == "admin":
            if self.db_manager.reset_all_qsl_data():
                QMessageBox.information(self, "操作成功", "所有QSL卡片数据已重置。")
                self.data_changed.emit()
            else:
                QMessageBox.critical(self, "操作失败", "重置数据时发生错误。")
        elif ok:
            QMessageBox.warning(self, "密码错误", "密码不正确，操作已取消。")

    def add_callsign(self):
        text, ok = QInputDialog.getText(self, "添加呼号", "请输入您的呼号:")
        if ok and text:
            callsign = text.upper().strip()
            if self.db_manager.add_callsign(callsign): self.load_settings()
            else: QMessageBox.warning(self, "错误", f"无法添加呼号 '{callsign}'。可能已存在。")
    def delete_callsign(self):
        current_item = self.callsign_list.currentItem();
        if not current_item: QMessageBox.warning(self, "操作提示", "请先选择一个要删除的呼号。"); return
        callsign = current_item.text()
        reply = QMessageBox.question(self, "确认删除", f"您确定要删除呼号 '{callsign}' 吗？", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes and self.db_manager.delete_callsign(callsign):
            if callsign == ConfigManager.get_config("primary_callsign"): ConfigManager.set_config("primary_callsign", "")
            self.load_settings()
    def set_primary(self):
        current_item = self.callsign_list.currentItem()
        if not current_item: QMessageBox.warning(self, "操作提示", "请先选择一个要设为主用的呼号。"); return
        callsign = current_item.text(); ConfigManager.set_config("primary_callsign", callsign); self.load_settings(); QMessageBox.information(self, "成功", f"'{callsign}' 已被设为您的主要呼号。")

# --- [REPLACE AddressLabelDialog CLASS] ---
class AddressLabelDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("打印地址标签 (70x50mm)")
        
        # --- 核心修改：固定窗口尺寸并禁用调整 ---
        # 设定固定尺寸 (宽度520, 高度650)
        FIXED_WIDTH = 1500
        FIXED_HEIGHT = 950
        self.setFixedSize(FIXED_WIDTH, FIXED_HEIGHT) 
        
        # 禁用最大化按钮和尺寸调整
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint) 
        # Qt.WindowCloseButtonHint | Qt.MSWindowsFixedSizeDialogHint 是另一种确保尺寸固定的方法
        
        main_layout = QVBoxLayout(self)
        
        # 1. 寄件人信息 (自动保存)
        sender_group = QGroupBox("寄件人信息 (自动保存)")
        sender_form = QFormLayout(sender_group)
        self.s_name = QLineEdit()
        self.s_phone = QLineEdit()
        self.s_zip = QLineEdit()
        self.s_country = QLineEdit() 
        self.s_country.setPlaceholderText("可选 (例如: P.R. China)")
        self.s_addr = QTextEdit()
        self.s_addr.setMaximumHeight(60)
        self.s_addr.setPlaceholderText("可使用管道符(|)强制换行；无|时将按核心行政区域词换行，每行最多16字。") 
        
        sender_form.addRow("姓名:", self.s_name)
        sender_form.addRow("电话:", self.s_phone)
        sender_form.addRow("邮编:", self.s_zip)
        sender_form.addRow("国家:", self.s_country)
        sender_form.addRow("地址:", self.s_addr)
        main_layout.addWidget(sender_group)
        
        # 2. 收件人信息
        receiver_group = QGroupBox("收件人信息")
        receiver_form = QFormLayout(receiver_group)
        self.r_name = QLineEdit()
        self.r_phone = QLineEdit()
        self.r_zip = QLineEdit()
        self.r_country = QLineEdit() 
        self.r_country.setPlaceholderText("可选")
        self.r_addr = QTextEdit()
        self.r_addr.setMaximumHeight(80)
        self.r_addr.setPlaceholderText("可使用管道符(|)强制换行；无|时将按核心行政区域词换行，每行最多16字。")
        
        receiver_form.addRow("姓名:", self.r_name)
        receiver_form.addRow("电话:", self.r_phone)
        receiver_form.addRow("邮编:", self.r_zip)
        receiver_form.addRow("国家:", self.r_country)
        
        # 常用操作按钮
        btn_row = QHBoxLayout()
        self.clear_btn = QPushButton("清空收件人")
        self.paste_btn = QPushButton("从剪贴板识别(简易)")
        btn_row.addWidget(self.clear_btn)
        btn_row.addWidget(self.paste_btn)
        
        receiver_form.addRow("地址:", self.r_addr)
        receiver_form.addRow(btn_row)
        main_layout.addWidget(receiver_group)
        
        # 3. 打印按钮
        self.print_btn = QPushButton("生成并打印")
        self.print_btn.setStyleSheet("background-color: #27ae60; height: 50px; font-size: 20px; font-weight: bold;")
        main_layout.addWidget(self.print_btn)
        
        # 信号连接
        self.print_btn.clicked.connect(self.do_print)
        self.clear_btn.clicked.connect(self.clear_receiver)
        self.paste_btn.clicked.connect(self.parse_clipboard)
        
        # 加载配置
        self.load_sender_config()
    
    def load_sender_config(self):
        self.s_name.setText(ConfigManager.get_config("addr_s_name", ""))
        self.s_phone.setText(ConfigManager.get_config("addr_s_phone", ""))
        self.s_zip.setText(ConfigManager.get_config("addr_s_zip", ""))
        self.s_country.setText(ConfigManager.get_config("addr_s_country", "")) # 加载国家
        self.s_addr.setPlainText(ConfigManager.get_config("addr_s_addr", ""))

    def save_sender_config(self):
        ConfigManager.set_config("addr_s_name", self.s_name.text())
        ConfigManager.set_config("addr_s_phone", self.s_phone.text())
        ConfigManager.set_config("addr_s_zip", self.s_zip.text())
        ConfigManager.set_config("addr_s_country", self.s_country.text()) # 保存国家
        ConfigManager.set_config("addr_s_addr", self.s_addr.toPlainText())

    def clear_receiver(self):
        self.r_name.clear()
        self.r_phone.clear()
        self.r_zip.clear()
        self.r_country.clear() # 清空国家
        self.r_addr.clear()

    def parse_clipboard(self):
        # 简易识别逻辑
        clipboard = QApplication.clipboard()
        text = clipboard.text()
        if not text: return
        parts = text.replace('，', ' ').replace(',', ' ').split()
        if len(parts) >= 1: self.r_name.setText(parts[0])
        if len(parts) >= 2: 
            if parts[1].isdigit() and len(parts[1]) > 6:
                self.r_phone.setText(parts[1])
            else:
                self.r_addr.setPlainText(parts[1])
        if len(parts) >= 3:
             self.r_addr.setPlainText("".join(parts[2:]))

    def do_print(self):
        self.save_sender_config()
        
        sender = {
            'name': self.s_name.text(),
            'phone': self.s_phone.text(),
            'zip': self.s_zip.text(),
            'country': self.s_country.text(), # 收集国家字段
            'address': self.s_addr.toPlainText()
        }
        receiver = {
            'name': self.r_name.text(),
            'phone': self.r_phone.text(),
            'zip': self.r_zip.text(),
            'country': self.r_country.text(), # 收集国家字段
            'address': self.r_addr.toPlainText()
        }
        
        if not receiver['name'] or not receiver['address']:
            QMessageBox.warning(self, "信息不全", "请至少填写收件人姓名和地址。")
            return

        if NewLayoutPrinter.generate_address_label(sender, receiver, self):
            QMessageBox.information(self, "成功", "地址标签已生成并发送至打印队列。")

# --- Log Detail/Edit Dialog ---
class LogDetailDialog(QDialog):
    def __init__(self, db_manager, my_callsign, log_id=None, parent=None):
        super().__init__(parent)
        self.db_manager = db_manager; self.log_id = log_id; self.my_callsign = my_callsign
        self.is_edit_mode = self.log_id is not None
        title = "编辑通联日志" if self.is_edit_mode else f"添加新通联日志 - [{self.my_callsign}]"
        self.setWindowTitle(title)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setFixedSize(1000, 1500)
        layout = QVBoxLayout(self)
        self.qso_type_combo = QComboBox(); self.qso_type_combo.addItems(["Basic (HF/VHF/UHF)", "Satellite", "Repeater", "Eyeball"])
        self.qso_type_combo.currentIndexChanged.connect(self.update_form_layout)
        type_layout = QFormLayout(); type_layout.addRow("通联类型:", self.qso_type_combo); layout.addLayout(type_layout)
        self.form_layout = QFormLayout()
        self.callsign_input = QLineEdit(); self.callsign_input.textChanged.connect(self.force_uppercase_callsign)
        self.qso_date_input = QDateEdit(); self.qso_date_input.setDisplayFormat("yyyy-MM-dd")
        self.time_on_input = QLineEdit()
        
        band_list = ["", "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "1.25m", "70cm", "33cm", "23cm", "13cm", "9cm", "5cm", "3cm", "1.2cm", "6mm", "4mm", "2.5mm", "2mm", "1mm", "N/A"]
        self.band_input = QComboBox(); self.band_input.addItems(band_list)
        self.band_rx_input = QComboBox(); self.band_rx_input.addItems(band_list)
        
        self.freq_input = QLineEdit(); self.freq_input.editingFinished.connect(self.update_band_from_freq)
        self.freq_rx_input = QLineEdit();
        self.mode_input = QComboBox(); self.mode_input.addItems(MODES_LIST)
        self.rst_sent_input = QLineEdit(); self.rst_rcvd_input = QLineEdit(); self.comment_input = QTextEdit()
        self.form_layout.addRow("对方呼号:", self.callsign_input); self.form_layout.addRow("日期 (UTC):", self.qso_date_input)
        self.form_layout.addRow("时间 (UTC):", self.time_on_input); self.form_layout.addRow("发射波段:", self.band_input)
        self.form_layout.addRow("接收波段:", self.band_rx_input); self.form_layout.addRow("发射频率 (MHz):", self.freq_input)
        self.form_layout.addRow("接收频率 (MHz):", self.freq_rx_input); self.form_layout.addRow("模式:", self.mode_input)
        self.form_layout.addRow("发送信号报告:", self.rst_sent_input); self.form_layout.addRow("接收信号报告:", self.rst_rcvd_input)
        self.satellite_frame = QFrame(); self.repeater_frame = QFrame(); self.eyeball_frame = QFrame()
        self.setup_dynamic_sections()
        self.form_layout.addRow(self.satellite_frame); self.form_layout.addRow(self.repeater_frame); self.form_layout.addRow(self.eyeball_frame)
        self.form_layout.addRow("备注:", self.comment_input); layout.addLayout(self.form_layout)
        #self.rst_sent_input = QLineEdit(); self.rst_rcvd_input = QLineEdit(); self.comment_input = QTextEdit()
        
        # --- 新增: QSL日期编辑框 ---
        self.qsl_sent_date_input = QLineEdit()
        self.qsl_sent_date_input.setPlaceholderText("YYYYMMDD (留空则未发)")
        self.qsl_rcvd_date_input = QLineEdit()
        self.qsl_rcvd_date_input.setPlaceholderText("YYYYMMDD (留空则未收)")
        # -------------------------
        
        # --- 新增: 将日期输入框添加到布局 ---
        self.form_layout.addRow("发卡时间 (Date):", self.qsl_sent_date_input)
        self.form_layout.addRow("收卡时间 (Date):", self.qsl_rcvd_date_input)
        # ---------------------------------
        if self.is_edit_mode:
            qsl_frame = QFrame(); qsl_frame.setFrameShape(QFrame.StyledPanel); qsl_layout = QFormLayout(qsl_frame)
            self.rc_card_label = QLineEdit("N/A"); self.rc_card_label.setReadOnly(True); self.tc_card_label = QLineEdit("N/A"); self.tc_card_label.setReadOnly(True)
            qsl_layout.addRow("收卡 (RC) 编号:", self.rc_card_label); qsl_layout.addRow("发卡 (TC) 编号:", self.tc_card_label); layout.addWidget(qsl_frame)
        self.buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        self.buttons.accepted.connect(self.accept); self.buttons.rejected.connect(self.reject); layout.addWidget(self.buttons); self.populate_data()

    def force_uppercase_callsign(self, text):
        self.callsign_input.setText(text.upper())

    def update_band_from_freq(self):
        try:
            freq_text = self.freq_input.text().lower()
            freq_mhz = 0
            if 'g' in freq_text:
                freq_mhz = float(freq_text.replace('g','').strip()) * 1000
            else:
                freq_mhz = float(freq_text)

            for (lower, upper), band in FREQ_BAND_MAP.items():
                if lower <= freq_mhz <= upper:
                    self.band_input.setCurrentText(band)
                    return
        except ValueError:
            pass # Ignore if input is not a valid float

    def setup_dynamic_sections(self):
        sat_layout = QFormLayout(self.satellite_frame); self.sat_name_input = QLineEdit(); self.prop_mode_input = QLineEdit()
        sat_layout.addRow("卫星名称:", self.sat_name_input); sat_layout.addRow("传播模式:", self.prop_mode_input)
        rep_layout = QFormLayout(self.repeater_frame); self.repeater_call_input = QLineEdit()
        rep_layout.addRow("中继呼号:", self.repeater_call_input)
        eye_layout = QFormLayout(self.eyeball_frame)
        self.eyeball_type_input = QComboBox(); self.eyeball_type_input.addItems(["EYEBALL", "Online EYEBALL", "Club activity", "Other"])
        eye_layout.addRow("Eyeball 类型:", self.eyeball_type_input)

    def update_form_layout(self):
        qso_type = self.qso_type_combo.currentText()
        is_sat = "Satellite" in qso_type
        is_rep = "Repeater" in qso_type
        is_eye = "Eyeball" in qso_type
        self.satellite_frame.setVisible(is_sat); self.repeater_frame.setVisible(is_rep); self.eyeball_frame.setVisible(is_eye)
        if is_eye:
            self.mode_input.setCurrentText("EYEBALL"); self.band_input.setCurrentText("N/A"); self.band_rx_input.setCurrentText("N/A")
            self.rst_sent_input.setText("59+"); self.rst_rcvd_input.setText("59+")
        else:
            if self.mode_input.currentText() == "EYEBALL": self.mode_input.setCurrentIndex(0)

    def populate_data(self):
        if not self.is_edit_mode:
            utc_now = QDateTime.currentDateTimeUtc()
            self.qso_date_input.setDateTime(utc_now)
            self.time_on_input.setText(utc_now.time().toString("hhmm"))
            self.rst_sent_input.setText("59"); self.rst_rcvd_input.setText("59"); self.update_form_layout(); return
        
        log_data = self.db_manager.get_log_details(self.log_id)
        if not log_data: QMessageBox.critical(self, "错误", "无法加载日志详情。"); self.reject(); return
        
        # ... 中间代码保持不变 ...
        
        self.rst_sent_input.setText(log_data['rst_sent'] or ''); self.rst_rcvd_input.setText(log_data['rst_rcvd'] or '')
        self.comment_input.setPlainText(log_data['comment'] or ''); self.sat_name_input.setText(log_data['sat_name'] or ''); self.prop_mode_input.setText(log_data['prop_mode'] or '')
        
        # --- 新增: 加载 QSL 时间 ---
        self.qsl_sent_date_input.setText(log_data['qsl_sent_date'] or '')
        self.qsl_rcvd_date_input.setText(log_data['qsl_rcvd_date'] or '')
        # -------------------------

        if log_data['submode']: self.eyeball_type_input.setCurrentText(log_data['submode'])
        
        qso_type_to_set = "Basic (HF/VHF/UHF)"
        if log_data['sat_name']:
            qso_type_to_set = "Satellite"
        elif log_data['mode'] == 'EYEBALL':
            qso_type_to_set = "Eyeball"
        elif log_data['freq_rx'] and (log_data['mode'] or "").upper() == 'FM':
            qso_type_to_set = "Repeater"
            
        self.qso_type_combo.blockSignals(True); self.qso_type_combo.setCurrentText(qso_type_to_set); self.qso_type_combo.blockSignals(False)
        self.callsign_input.setText(log_data['station_callsign'] or '')
        try:
            qso_date_str = log_data['qso_date']
            if qso_date_str: self.qso_date_input.setDate(QDate.fromString(qso_date_str, "yyyyMMdd"))
            else: self.qso_date_input.setDate(QDate.currentDate())
        except Exception: self.qso_date_input.setDate(QDate.currentDate())
        self.time_on_input.setText(log_data['time_on'] or ''); self.band_input.setCurrentText((log_data['band'] or '').lower())
        self.band_rx_input.setCurrentText((log_data['band_rx'] or '').lower()); self.freq_input.setText(str(log_data['freq'] or ''))
        self.freq_rx_input.setText(str(log_data['freq_rx'] or '')); self.mode_input.setCurrentText(log_data['mode'] or '')
        self.rst_sent_input.setText(log_data['rst_sent'] or ''); self.rst_rcvd_input.setText(log_data['rst_rcvd'] or '')
        self.comment_input.setPlainText(log_data['comment'] or ''); self.sat_name_input.setText(log_data['sat_name'] or ''); self.prop_mode_input.setText(log_data['prop_mode'] or '')
        if log_data['submode']: self.eyeball_type_input.setCurrentText(log_data['submode'])
        qsl_cards = self.db_manager.get_qsl_cards_for_log(self.log_id)
        for card in qsl_cards:
            if card['direction'] == 'RC': self.rc_card_label.setText(card['qsl_id'])
            elif card['direction'] == 'TC': self.tc_card_label.setText(card['qsl_id'])
        self.update_form_layout()
        
    def get_data(self) -> dict:
        data = { 
            "station_callsign": self.callsign_input.text().upper(), 
            "qso_date": self.qso_date_input.date().toString("yyyyMMdd"), 
            "time_on": self.time_on_input.text(), 
            "band": self.band_input.currentText(), 
            "band_rx": self.band_rx_input.currentText(), 
            "freq": self.freq_input.text(), 
            "freq_rx": self.freq_rx_input.text(), 
            "mode": self.mode_input.currentText(), 
            "rst_sent": self.rst_sent_input.text(), 
            "rst_rcvd": self.rst_rcvd_input.text(), 
            "comment": self.comment_input.toPlainText(), 
            "my_callsign": self.my_callsign, 
            "sat_name": None, 
            "prop_mode": None, 
            "submode": None,
            # --- 新增: 获取 QSL 时间 ---
            "qsl_sent_date": self.qsl_sent_date_input.text().strip() or None,
            "qsl_rcvd_date": self.qsl_rcvd_date_input.text().strip() or None
            # -------------------------
        }
        qso_type = self.qso_type_combo.currentText()
        if "Satellite" in qso_type: data.update({"sat_name": self.sat_name_input.text(), "prop_mode": self.prop_mode_input.text()})
        elif "Repeater" in qso_type:
            repeater_call = self.repeater_call_input.text()
            if repeater_call: data["comment"] = f"RPT: {repeater_call} | {data['comment']}"
        elif "Eyeball" in qso_type: data["submode"] = self.eyeball_type_input.currentText()
        return data

# --- Log Table Model ---
class LogTableModel(QAbstractTableModel):
    def __init__(self, data, headers):
        super().__init__()
        self._data = data
        self._headers = headers
        self._checked_states = [Qt.Unchecked] * len(self._data)
        self._qsl_sent_col_idx = headers.index("已发?") + 1
        self._qsl_rcvd_col_idx = headers.index("已收?") + 1
        self._special_cols = [self._qsl_sent_col_idx, self._qsl_rcvd_col_idx]

    def data(self, index, role):
        if not index.isValid():
            return None

        column = index.column()
        row = index.row()

        if role == Qt.CheckStateRole and column == 0:
            return self._checked_states[row]

        value = self._data[row][column - 1] if column > 0 else None

        if role == Qt.DisplayRole:
            if column in self._special_cols:
                return '✔' if value == 'Y' else '✖'
            if column > 0:
                return str(value or "")

        if role == Qt.ForegroundRole:
            if column in self._special_cols:
                return QColor("green") if value == 'Y' else QColor("red")

        if role == Qt.TextAlignmentRole:
            if column in self._special_cols:
                return Qt.AlignCenter

        return None

    def setData(self, index, value, role):
        if role == Qt.CheckStateRole and index.column() == 0:
            self._checked_states[index.row()] = value; self.dataChanged.emit(index, index); return True
        return super().setData(index, value, role)
    def flags(self, index):
        flags = super().flags(index)
        if index.column() == 0: flags |= Qt.ItemIsUserCheckable
        return flags
    def rowCount(self, p): return len(self._data)
    def columnCount(self, p): return len(self._headers) + 1
    def headerData(self, section, orientation, role):
        if role == Qt.DisplayRole and orientation == Qt.Horizontal:
            if section == 0: return ""
            else: return self._headers[section - 1]
        return None
    def update_data(self, new_data):
        self.beginResetModel(); self._data = new_data; self._checked_states = [Qt.Unchecked] * len(self._data); self.endResetModel()
    def get_checked_log_ids(self): return [str(self._data[i][0]) for i, state in enumerate(self._checked_states) if state == Qt.Checked]

# --- Log Management Widget ---
class LogManagementWidget(QWidget):
    back_to_dashboard_signal = pyqtSignal(); data_changed_signal = pyqtSignal()
    def __init__(self, db_manager): super().__init__(); self.db_manager = db_manager; self.init_ui(); self.load_initial_data()
    def init_ui(self):
        main_layout = QVBoxLayout(self); filter_box = QFrame(); filter_box.setObjectName("filterBox")
        filter_layout = QFormLayout(filter_box)
        self.my_callsign_filter = QLineEdit(); self.my_callsign_filter.setPlaceholderText("实时过滤我方呼号...")
        self.callsign_filter = QLineEdit(); self.callsign_filter.setPlaceholderText("实时过滤对方呼号...")
        self.qsl_id_filter = QLineEdit(); self.qsl_id_filter.setPlaceholderText("通过QSL卡号精确查找...")
        self.mode_filter = QComboBox(); self.mode_filter.addItems(["全部模式"] + [m for m in MODES_LIST if m])
        filter_layout.addRow("我方呼号:", self.my_callsign_filter); filter_layout.addRow("对方呼号:", self.callsign_filter)
        filter_layout.addRow("QSL卡号:", self.qsl_id_filter); filter_layout.addRow("通联模式:", self.mode_filter)
        button_layout = QHBoxLayout(); self.reset_button = QPushButton("重置所有条件"); self.reorder_button = QPushButton("按时间重排")
        button_layout.addStretch(); button_layout.addWidget(self.reorder_button); button_layout.addWidget(self.reset_button)
        filter_layout.addRow(button_layout); main_layout.addWidget(filter_box)
        self.table_view = QTableView(); self.table_view.setAlternatingRowColors(True); self.table_view.setSelectionBehavior(QTableView.SelectRows)
        self.table_view.setSortingEnabled(False)
        self.table_view.horizontalHeader().setStretchLastSection(True); self.table_view.setEditTriggers(QTableView.NoEditTriggers)
        main_layout.addWidget(self.table_view)
        bottom_button_layout = QHBoxLayout()
        self.card_in_button = QPushButton("确认收卡 (RC)"); self.card_out_button = QPushButton("确认发卡 (TC)")
        self.reprint_button = QPushButton("补打标签"); self.write_nfc_button = QPushButton("写入NFC") # New Button
        self.check_duplicates_button = QPushButton("检查并合并重复项")
        self.recycle_card_button = QPushButton("回收卡号"); self.delete_log_button = QPushButton("删除日志")
        bottom_button_layout.addWidget(self.card_in_button); bottom_button_layout.addWidget(self.card_out_button); bottom_button_layout.addWidget(self.reprint_button)
        bottom_button_layout.addWidget(self.write_nfc_button); # Add to layout
        bottom_button_layout.addWidget(self.check_duplicates_button); bottom_button_layout.addWidget(self.recycle_card_button); bottom_button_layout.addWidget(self.delete_log_button)
        bottom_button_layout.addStretch(); self.back_button = QPushButton("返回主菜单"); bottom_button_layout.addWidget(self.back_button)
        main_layout.addLayout(bottom_button_layout)
        self.my_callsign_filter.textChanged.connect(lambda text: self.my_callsign_filter.setText(text.upper()))
        self.my_callsign_filter.textChanged.connect(self.apply_filters)
        self.callsign_filter.textChanged.connect(lambda text: self.callsign_filter.setText(text.upper()))
        self.callsign_filter.textChanged.connect(self.apply_filters)
        self.qsl_id_filter.textChanged.connect(lambda text: self.qsl_id_filter.setText(text.upper()))
        self.qsl_id_filter.returnPressed.connect(self.apply_filters)
        self.mode_filter.currentIndexChanged.connect(self.apply_filters); self.reset_button.clicked.connect(self.reset_filters)
        self.reorder_button.clicked.connect(self.reorder_logs)
        self.card_in_button.clicked.connect(lambda: self.process_qsl_cards('RC')); self.card_out_button.clicked.connect(lambda: self.process_qsl_cards('TC'))
        self.reprint_button.clicked.connect(self.reprint_label); self.write_nfc_button.clicked.connect(self.write_nfc_card) # Connect new button
        self.check_duplicates_button.clicked.connect(self.check_for_duplicates)
        self.delete_log_button.clicked.connect(self.delete_selected_logs); self.recycle_card_button.clicked.connect(self.recycle_selected_card)
        self.table_view.doubleClicked.connect(self.edit_selected_log); self.back_button.clicked.connect(self.back_to_dashboard_signal.emit)

    def load_initial_data(self):
        self.headers = ["ID", "我方呼号", "对方呼号", "日期", "时间", "TX 波段", "RX 波段", "TX 频率", "RX 频率", "模式", "已发?", "已收?", "备注"]
        self.model = LogTableModel([], self.headers); self.table_view.setModel(self.model); self.table_view.setColumnWidth(0, 40); self.apply_filters()
    def apply_filters(self):
        logs = self.db_manager.search_logs(my_callsign=self.my_callsign_filter.text(), station_callsign=self.callsign_filter.text(), mode=self.mode_filter.currentText(), qsl_id=self.qsl_id_filter.text())
        self.model.update_data(logs)
    def reset_filters(self):
        self.my_callsign_filter.clear(); self.callsign_filter.clear(); self.qsl_id_filter.clear(); self.mode_filter.setCurrentIndex(0); self.apply_filters()
    def reorder_logs(self):
        reply = QMessageBox.question(self, "确认操作", "此操作将根据通联时间重新排列所有日志的序号，并刷新列表。\n您确定要继续吗？", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            if self.db_manager.reorder_logs_by_time():
                QMessageBox.information(self, "成功", "日志已按时间重新排序。")
                self.apply_filters()
                self.data_changed_signal.emit()
            else:
                QMessageBox.critical(self, "失败", "重新排序时发生数据库错误。")

    def process_qsl_cards(self, direction):
        log_ids_to_process = []
        skipped_count = 0

        for log_id in self.model.get_checked_log_ids():
            log_details = self.db_manager.get_log_details(log_id)
            if not log_details: continue

            if direction == 'TC' and log_details['qsl_sent'] == 'Y':
                skipped_count += 1
                continue
            if direction == 'RC' and log_details['qsl_rcvd'] == 'Y':
                skipped_count += 1
                continue
            log_ids_to_process.append(log_id)

        if not log_ids_to_process:
            QMessageBox.information(self, "操作提示", f"所有勾选的日志都已经有相应的卡片记录，已全部跳过。")
            return

        mode = "multi"
        if len(log_ids_to_process) > 1:
            # BatchQslModeDialog 仍然保留，用于处理 QSL ID 的归并逻辑
            dialog = BatchQslModeDialog(len(log_ids_to_process), self)
            if dialog.exec() == QDialog.Accepted: mode = dialog.mode
            else: return

        # --- 移除 DEFAULT_TO_LAYOUT_1 判定和 PrintLayoutDialog 调用 ---
        if direction == 'TC':
            # 发卡 (TC): 使用 layout 1 (QSO 数据 + QSLID 二维码)
            layout_func = NewLayoutPrinter.generate_layout_1
            #QMessageBox.information(self, "打印模式", f"发卡标签打印：(版式 1)")
        elif direction == 'RC':
            # 收卡 (RC): 使用 layout 2 (纯 QSLID 二维码)
            layout_func = NewLayoutPrinter.generate_layout_2
            #QMessageBox.information(self, "打印模式", f"收卡标签打印：(版式 2)")
        else:
            #QMessageBox.critical(self, "操作失败", "无法识别的操作方向。")
            return
            
        self.run_print_job(layout_func, log_ids_to_process, direction, mode)
        # --- 打印逻辑结束 ---
        
        self.apply_filters()
        self.data_changed_signal.emit()
    def run_print_job(self, print_function, log_ids, direction, mode):
        processed_count = 0
        if mode == "single":
            qsl_id = QSL_ID_Generator.generate(self.db_manager, direction)
            if self.db_manager.add_qsl_card(qsl_id, log_ids, direction):
                processed_count = len(log_ids)
                log_data_list = [self.db_manager.get_log_details(log_id) for log_id in log_ids]
                print_function(qsl_id, log_data_list, self)
        else: # multi mode
            for log_id in log_ids:
                qsl_id = QSL_ID_Generator.generate(self.db_manager, direction)
                if self.db_manager.add_qsl_card(qsl_id, [log_id], direction):
                    processed_count += 1
                    log_data_list = [self.db_manager.get_log_details(log_id)]
                    print_function(qsl_id, log_data_list, self)
        
        if processed_count > 0:
            QMessageBox.information(self, "操作成功", f"成功为 {processed_count} 条日志生成卡片。")

    def reprint_label(self):
        log_ids = self.model.get_checked_log_ids()

        if not log_ids:
            QMessageBox.warning(self, "操作提示", "请勾选一个日志进行标签补打。")
            return
        if len(log_ids) > 1:
            QMessageBox.warning(self, "操作无效", "请一次只选择一个日志进行标签补打。")
            return

        log_id = log_ids[0]

        cards = self.db_manager.get_qsl_cards_for_log(log_id)
        if not cards:
            QMessageBox.information(self, "提示", "所选日志没有关联的QSL卡。")
            return

        dialog = CardActionDialog("选择要补打的标签", cards, self)
        if dialog.exec_() == QDialog.Accepted and dialog.selected_card_info:
            
            # --- 修正 1：将 sqlite3.Row 转换为 dict ---
            # 解决 AttributeError，并方便访问键值
            selected_card_info_dict = dict(dialog.selected_card_info)
            
            qsl_id_to_print = selected_card_info_dict['qsl_id']
            # --- 关键修正 2：直接使用 CardActionDialog 返回的 'direction' 键 ---
            card_direction = selected_card_info_dict.get('direction', '')
            
            logs_for_this_card = self.db_manager.get_logs_for_qsl_card(qsl_id_to_print)
            if not logs_for_this_card:
                QMessageBox.critical(self, "数据库错误", f"找不到卡号 {qsl_id_to_print} 关联的日志。")
                return

            log_data_list = [self.db_manager.get_log_details(lid['log_id']) for lid in logs_for_this_card]

            # --- 根据明确的 direction 自动选择版式 ---
            if card_direction == 'RC':
                # 补打收卡标签：使用 layout 2 (纯 QSLID二维码)
                #QMessageBox.information(self, "补打模式", f"补打收卡标签：QSL ID {qsl_id_to_print} (版式 2)")
                NewLayoutPrinter.generate_layout_2(qsl_id_to_print, log_data_list, self)
            elif card_direction == 'TC':
                # 补打发卡标签：使用 layout 1 (QSO数据网格 + QSLID二维码)
                #QMessageBox.information(self, "补打模式", f"补打发卡标签：QSL ID {qsl_id_to_print} (版式 1)")
                NewLayoutPrinter.generate_layout_1(qsl_id_to_print, log_data_list, self)
            else:
                QMessageBox.warning(self, "补打失败", 
                                    f"无法确定 QSL ID {qsl_id_to_print} 的卡片方向 ({card_direction})。")
    def write_nfc_card(self):
        """Handle writing an existing QSL ID to an NFC card."""
        log_ids = self.model.get_checked_log_ids()

        if len(log_ids) != 1:
            QMessageBox.warning(self, "操作提示", "请勾选一条且仅一条日志来写入NFC卡。")
            return

        log_id = log_ids[0]
        cards = self.db_manager.get_qsl_cards_for_log(log_id)

        if not cards:
            QMessageBox.information(self, "无卡号", "所选日志没有关联的QSL卡号，无法写入。")
            return

        dialog = CardActionDialog("选择要写入NFC的卡号", cards, self)
        if dialog.exec_() == QDialog.Accepted and dialog.selected_card_info:
            qsl_id_to_write = dialog.selected_card_info['qsl_id']
            nfc_dialog = NfcWriteDialog(qsl_id_to_write, self)
            nfc_dialog.exec_()


    def edit_selected_log(self, index):
        log_id = self.model.data(self.model.index(index.row(), 1), Qt.DisplayRole)
        my_callsign = self.model.data(self.model.index(index.row(), 2), Qt.DisplayRole)
        dialog = LogDetailDialog(self.db_manager, my_callsign, log_id, self)
        if dialog.exec() == QDialog.Accepted:
            updated_data = dialog.get_data()
            if self.db_manager.update_log_entry(log_id, updated_data): QMessageBox.information(self, "成功", f"日志 (ID: {log_id}) 已更新。"); self.apply_filters()
            else: QMessageBox.critical(self, "错误", "无法更新日志。")
    def search_by_qsl_id(self, qsl_id):
        self.qsl_id_filter.setText(qsl_id); self.apply_filters()
    def check_for_duplicates(self):
        QMessageBox.information(self, "开始查重", "将开始扫描整个数据库查找并合并重复日志，这可能需要一些时间。")
        duplicate_sets = self.db_manager.find_all_duplicates()
        if not duplicate_sets:
            QMessageBox.information(self, "查重完成", "未发现重复的日志记录。")
            return

        merged_count = 0
        for duplicate_set in duplicate_sets:
            log_ids = sorted(list(duplicate_set))
            master_log_id = log_ids[0]
            master_log_data = dict(self.db_manager.get_log_details(master_log_id))

            logs_to_delete = []

            for i in range(1, len(log_ids)):
                duplicate_log_id = log_ids[i]
                duplicate_log_data_row = self.db_manager.get_log_details(duplicate_log_id)
                if not duplicate_log_data_row: continue
                duplicate_log_data = dict(duplicate_log_data_row)

                needs_update = False
                for key in duplicate_log_data.keys():
                    if key in ['id', 'adif_blob']: continue
                    new_value = duplicate_log_data.get(key)
                    if new_value and not master_log_data.get(key):
                        master_log_data[key] = new_value
                        needs_update = True

                new_comment = duplicate_log_data.get('comment', ''); old_comment = master_log_data.get('comment', '')
                if new_comment and new_comment not in (old_comment or ""):
                    master_log_data['comment'] = f"{old_comment or ''} | MERGED: {new_comment}".strip(" | "); needs_update = True

                logs_to_delete.append(duplicate_log_id)

            if needs_update:
                self.db_manager.update_log_entry(master_log_id, master_log_data)

            for log_id_to_delete in logs_to_delete:
                self.db_manager.delete_log(log_id_to_delete)

            merged_count += 1

        QMessageBox.information(self, "合并完成", f"已自动合并 {merged_count} 组重复的日志记录。")
        self.apply_filters()
    def delete_selected_logs(self):
        log_ids = self.model.get_checked_log_ids()
        if not log_ids: QMessageBox.warning(self, "操作提示", "请先在表格中勾选要删除的日志。"); return

        reply = QMessageBox.question(self, "确认删除", f"您确定要永久删除选中的 {len(log_ids)} 条日志吗？\n此操作不可恢复！", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            deleted_count = 0
            for log_id in log_ids:
                if self.db_manager.delete_log(log_id): deleted_count += 1
            QMessageBox.information(self, "操作完成", f"成功删除 {deleted_count} 条日志。")
            self.apply_filters(); self.data_changed_signal.emit()
    def recycle_selected_card(self):
        log_ids = self.model.get_checked_log_ids()
        if len(log_ids) != 1: QMessageBox.warning(self, "操作提示", "请勾选一条且仅一条日志来回收其关联的QSL卡号。"); return

        log_id = log_ids[0]
        cards = self.db_manager.get_qsl_cards_for_log(log_id)
        if not cards: QMessageBox.information(self, "提示", "该日志没有关联的QSL卡，无需回收。"); return

        dialog = CardActionDialog("选择要回收的卡号", cards, self)
        if dialog.exec() == QDialog.Accepted and dialog.selected_card_info:
            direction = dialog.selected_card_info['direction']
            if self.db_manager.recycle_qsl_card(log_id, direction):
                QMessageBox.information(self, "操作成功", f"成功回收该日志的 {direction} 卡号。")
                self.apply_filters(); self.data_changed_signal.emit()
            else: QMessageBox.warning(self, "操作失败", "无法回收卡号。")
            
# --- Hardware Control Widget ---
class HardwareWidget(QWidget):
    back_to_dashboard_signal = pyqtSignal()
    search_qsl_id_signal = pyqtSignal(str)

    def __init__(self, db_manager, parent=None):
        super().__init__(parent)
        self.db_manager = db_manager
        self.init_ui()

    def init_ui(self):
        top_level_layout = QVBoxLayout(self)
        main_layout = QHBoxLayout()
        main_layout.setSpacing(20)

        # --- Left Pane ---
        left_pane = QWidget()
        left_layout = QVBoxLayout(left_pane)
        left_layout.setContentsMargins(0, 0, 0, 0)

        # Manual Input Group
        input_zone = QGroupBox("手动输入")
        input_layout = QVBoxLayout(input_zone)
        self.manual_input = QLineEdit(); self.manual_input.setPlaceholderText("输入QSL卡号后按回车查询...")
        self.manual_input.textChanged.connect(lambda text: self.manual_input.setText(text.upper()))
        self.manual_input.returnPressed.connect(self.search_manual_code)
        input_layout.addWidget(self.manual_input)

        left_layout.addWidget(input_zone)
        left_layout.addStretch(1)

        # --- Right Pane ---
        right_pane = QGroupBox("查询结果")
        right_layout = QVBoxLayout(right_pane)
        self.results_browser = QTextBrowser()
        self.results_browser.setStyleSheet("font-size: 28px;")
        right_layout.addWidget(self.results_browser)

        # --- Main Layout Assembly ---
        main_layout.addWidget(left_pane, 1)
        main_layout.addWidget(right_pane, 2)

        # --- Bottom Bar for Back Button ---
        back_button_layout = QHBoxLayout();
        back_button_layout.addStretch()
        self.back_button = QPushButton("返回主菜单");
        back_button_layout.addWidget(self.back_button)

        top_level_layout.addLayout(main_layout)
        top_level_layout.addLayout(back_button_layout)

        # Connections
        self.back_button.clicked.connect(self.leave_view)
        self.back_button.clicked.connect(self.back_to_dashboard_signal.emit)

    def search_manual_code(self):
        code = self.manual_input.text().strip().upper()
        if code:
            self._perform_search(code)
            self.manual_input.clear()

    def _perform_search(self, qsl_id_prefix):
        matching_qsl_cards = self.db_manager.get_logs_for_qsl_id_prefix(qsl_id_prefix)

        if not matching_qsl_cards:
            self.results_browser.setHtml(f"<h3>未找到与 QSL 卡号 '{qsl_id_prefix}' 相关的日志。</h3>")
            return

        full_html = ""
        for card_row in matching_qsl_cards:
            full_qsl_id = card_row['qsl_id']
            full_html += f"<h3>QSL 卡号: {full_qsl_id}</h3>"

            logs_for_this_card = self.db_manager.get_logs_for_qsl_card(full_qsl_id)

            if logs_for_this_card:
                full_html += "<p><b>关联的通联日志:</b></p>"
                for i, log_row in enumerate(logs_for_this_card):
                    if i > 0: full_html += "<hr>"
                    log_details = dict(self.db_manager.get_log_details(log_row['log_id']))
                    if log_details:
                        details_html = f"""
                                <p>
                                <b>对方呼号:</b> {log_details.get('station_callsign', '')}<br>
                                <b>我方呼号:</b> {log_details.get('my_callsign', '')}<br>
                                <b>日期/时间 (UTC):</b> {log_details.get('qso_date', '')} / {log_details.get('time_on', '')}Z<br>
                                <b>频率/波段:</b> {log_details.get('freq', 'N/A')} MHz / {log_details.get('band', 'N/A')}<br>
                                <b>模式:</b> {log_details.get('mode', '')} {log_details.get('submode', '') or ''}<br>
                                <b>信号报告 (S/R):</b> {log_details.get('rst_sent', '')} / {log_details.get('rst_rcvd', '')}<br>
                            """
                        if log_details.get('sat_name'):
                            details_html += f"<b>卫星:</b> {log_details['sat_name']}<br>"
                        if log_details.get('comment'):
                                details_html += f"<b>备注:</b> {log_details['comment']}"

                        details_html += "</p>"
                        full_html += details_html

            else:
                full_html += "<p>无关联的通联日志。</p>"
            full_html += "<hr style='border: 1px solid #7f8c8d;'>"

        self.results_browser.setHtml(full_html.removesuffix("<hr style='border: 1px solid #7f8c8d;'>"))

    def enter_view(self):
        self.manual_input.setFocus()

    def leave_view(self):
        self.manual_input.clear()
        self.results_browser.clear()
    
    def closeEvent(self, event):
        # Placeholder for any cleanup needed when the window closes
        pass

# --- Main Application Window ---
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        os.makedirs("database", exist_ok=True)
        self.db_manager = DatabaseManager(DB_FILE); self.adif_handler = ADIF_Handler()
        self.init_database(); self.init_ui()
    def init_ui(self):
        self.setWindowTitle("QSL Card Manager"); self.setGeometry(100, 100, 1200, 800)
        self.statusBar().showMessage("准备就绪")
        try:
            with open(STYLE_SHEET_FILE, "r", encoding="utf-8") as f: self.setStyleSheet(f.read())
        except FileNotFoundError: print(f"Warning: Stylesheet '{STYLE_SHEET_FILE}' not found.")
        self.central_widget = QWidget(); self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget); self.stacked_widget = QStackedWidget()
        self.main_layout.addWidget(self.stacked_widget); self.create_dashboard_view()
        self.log_management_view = LogManagementWidget(self.db_manager)
        self.hardware_view = HardwareWidget(self.db_manager)
        
        self.log_management_view.back_to_dashboard_signal.connect(self.show_dashboard)
        self.log_management_view.data_changed_signal.connect(self.update_dashboard_stats)
        self.hardware_view.back_to_dashboard_signal.connect(self.show_dashboard)
        
        self.stacked_widget.addWidget(self.log_management_view)
        self.stacked_widget.addWidget(self.hardware_view)
        
        self.stacked_widget.setCurrentWidget(self.dashboard_view)

    def show_dashboard(self):
        self.hardware_view.leave_view()
        self.log_management_view.reset_filters()
        self.stacked_widget.setCurrentWidget(self.dashboard_view); self.update_dashboard_stats()

    def create_dashboard_view(self):
        self.dashboard_view = QWidget(); self.dashboard_view.setObjectName("dashboard_view"); main_hbox = QHBoxLayout(self.dashboard_view)
        tile_widget = QWidget(); tile_layout = QGridLayout(tile_widget)
        
        # --- [MODIFIED SECTION START] ---
        tiles = {
            "new_log": ("新通联日志", self.on_new_log_clicked), 
            "log_management": ("日志管理", self.on_log_manage_clicked), 
            "import_adif": ("导入ADIF", self.on_import_clicked), 
            "hardware_scan": ("手动查询", self.on_scan_clicked),
            "address_label": ("打印地址标签", self.on_address_label_clicked),
            "inventory_update": ("卡片出入库更新", self.on_inventory_update_clicked), # <--- 新增此项
             "settings": ("设置", self.on_settings_clicked)
        }
        # 更新布局坐标，确保放得下 (7个瓦片，占用 (3,0) 位置)
        positions = [(0,0), (0,1), (1,0), (1,1), (2,0), (2,1), (3,0)] 
        # --- [MODIFIED SECTION END] ---
        
        # Unpack items safely
        items = list(tiles.items())
        
        for i, position in enumerate(positions):
            if i < len(items):
                key, (text, func) = items[i]
                button = QPushButton(text)
                button.setObjectName("tileButton")
                button.setMinimumSize(180, 120)
                button.clicked.connect(func)
                tile_layout.addWidget(button, *position)

        self.quit_button = QPushButton("退出系统"); self.quit_button.setObjectName("quitButton")
         # 修改退出按钮的位置到第 4 行，跨两列
        self.quit_button.setMinimumSize(180, 120); self.quit_button.clicked.connect(self.close)
        tile_layout.addWidget(self.quit_button, 4, 0, 1, 2) # **将 3 改为 4**

        main_hbox.addWidget(tile_widget, 1) # Changed stretch factor
        stats_widget = QFrame(); stats_widget.setFrameShape(QFrame.StyledPanel); stats_vbox = QVBoxLayout(stats_widget)
        stats_group_label = QLabel("数据统计"); stats_group_label.setObjectName("statsHeader")
        stats_form = QFormLayout()
        self.total_logs_label = QLabel("0"); self.sent_cards_label = QLabel("0"); self.received_cards_label = QLabel("0")
        stats_form.addRow("总日志数:", self.total_logs_label); stats_form.addRow("已发卡片:", self.sent_cards_label); stats_form.addRow("已收卡片:", self.received_cards_label)
        activity_group_label = QLabel("近期动态"); activity_group_label.setObjectName("statsHeader")
        self.activity_list = QListWidget()
        stats_vbox.addWidget(stats_group_label); stats_vbox.addLayout(stats_form); stats_vbox.addWidget(activity_group_label); stats_vbox.addWidget(self.activity_list)
        main_hbox.addWidget(stats_widget, 1) # Changed stretch factor
        self.stacked_widget.addWidget(self.dashboard_view); self.update_dashboard_stats()

    def update_dashboard_stats(self):
        log_count = self.db_manager.get_total_log_count(); sent_count = self.db_manager.get_qsl_count("TC"); rcvd_count = self.db_manager.get_qsl_count("RC")
        self.total_logs_label.setText(str(log_count)); self.sent_cards_label.setText(str(sent_count)); self.received_cards_label.setText(str(rcvd_count))
        self.activity_list.clear()
        recent_activity = self.db_manager.get_recent_qsl_activity()
        for activity in recent_activity:
            direction = "收到" if activity['direction'] == 'RC' else "寄出"; color = "#27ae60" if activity['direction'] == 'RC' else "#e67e22"
            item_text = f"<b>{direction}</b> {activity['station_callsign']} 的卡片"
            list_item = QListWidgetItem(); label = QLabel(item_text); label.setStyleSheet(f"color: {color};")
            self.activity_list.addItem(list_item); self.activity_list.setItemWidget(list_item, label)
    def init_database(self): self.db_manager.initialize_database(); print("Database initialized successfully.")
    def on_address_label_clicked(self):
        dialog = AddressLabelDialog(self)
        dialog.exec_()
    def on_new_log_clicked(self):
        primary_callsign = ConfigManager.get_config("primary_callsign")
        if not primary_callsign: QMessageBox.information(self, "设置提示", "请先在“设置”中添加并设置一个主要呼号。"); self.on_settings_clicked(); return
        dialog = LogDetailDialog(self.db_manager, my_callsign=primary_callsign, parent=self)
        if dialog.exec() == QDialog.Accepted:
            log_data = dialog.get_data()
            if self.db_manager.log_exists(log_data['station_callsign'], log_data['qso_date'], log_data['time_on'], log_data['band'], log_data['mode']):
                QMessageBox.warning(self, "重复日志", "该通联记录已存在，无法重复添加。"); return
            log_id = self.db_manager.add_log_entry(log_data)
            if log_id:
                log_data['id'] = log_id; adif_record = self.adif_handler.qso_to_adif_record(log_data)
                self.adif_handler.append_to_logbook(adif_record); QMessageBox.information(self, "成功", f"新日志已添加 (ID: {log_id}) 并已记录到 logbook.adi。")
                if self.stacked_widget.currentWidget() == self.log_management_view: self.log_management_view.apply_filters()
                self.update_dashboard_stats()
    def on_log_manage_clicked(self): self.log_management_view.load_initial_data(); self.stacked_widget.setCurrentWidget(self.log_management_view)
    def on_import_clicked(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择ADIF日志文件", "", "ADIF Files (*.adi);;All Files (*)")
        if not file_path: return
        try:
            qsos, _ = adif_io.read_from_file(file_path); imported_count, updated_count, duplicate_count = 0, 0, 0
            my_configured_callsigns = self.db_manager.get_all_my_callsigns(); primary_callsign = ConfigManager.get_config("primary_callsign")
            for qso in qsos:
                band = qso.get('BAND', '')
                if not all(k in qso for k in ['CALL', 'QSO_DATE', 'TIME_ON', 'BAND']): continue

                existing_log_id = self.db_manager.log_exists(qso['CALL'], qso['QSO_DATE'], qso['TIME_ON'], band, qso.get('MODE'))
                if existing_log_id:
                    existing_log = self.db_manager.get_log_details(existing_log_id)
                    merged_data = dict(existing_log); needs_update = False

                    new_log_data = {'station_callsign': qso.get('CALL'), 'qso_date': qso.get('QSO_DATE'), 'time_on': qso.get('TIME_ON'), 'band': band, 'band_rx': qso.get('BAND_RX'), 'freq': qso.get('FREQ'), 'freq_rx': qso.get('FREQ_RX'), 'mode': qso.get('MODE'), 'rst_sent': qso.get('RST_SENT'), 'rst_rcvd': qso.get('RST_RCVD'), 'comment': qso.get('COMMENT', ''), 'my_callsign': qso.get('OPERATOR', primary_callsign), 'submode': qso.get('SUBMODE'), 'sat_name': qso.get('SAT_NAME'), 'prop_mode': qso.get('PROP_MODE')}

                    for key, new_value in new_log_data.items():
                        if new_value and not merged_data.get(key):
                            merged_data[key] = new_value; needs_update = True

                    new_comment = new_log_data.get('comment', ''); old_comment = merged_data.get('comment', '')
                    if new_comment and new_comment not in (old_comment or ""):
                        merged_data['comment'] = f"{old_comment or ''} | IMPORTED: {new_comment}".strip(" | "); needs_update = True

                    if needs_update:
                        self.db_manager.update_log_entry(existing_log_id, merged_data); updated_count += 1
                    else: duplicate_count += 1
                else:
                    operator = qso.get('OPERATOR', '').upper(); my_call = operator if operator in my_configured_callsigns else primary_callsign
                    log_data = { 'station_callsign': qso.get('CALL'), 'qso_date': qso.get('QSO_DATE'), 'time_on': qso.get('TIME_ON'), 'band': band, 'band_rx': qso.get('BAND_RX'), 'freq': qso.get('FREQ'), 'freq_rx': qso.get('FREQ_RX'), 'mode': qso.get('MODE'), 'rst_sent': qso.get('RST_SENT'), 'rst_rcvd': qso.get('RST_RCVD'), 'comment': qso.get('COMMENT', ''), 'my_callsign': my_call, 'submode': qso.get('SUBMODE'), 'sat_name': qso.get('SAT_NAME'), 'prop_mode': qso.get('PROP_MODE') }
                    self.db_manager.add_log_entry(log_data); imported_count += 1
            QMessageBox.information(self, "导入完成", f"成功导入 {imported_count} 条新日志。\n更新合并 {updated_count} 条已有日志。\n发现 {duplicate_count} 条完全重复日志已跳过。")
            if self.stacked_widget.currentWidget() == self.log_management_view: self.log_management_view.apply_filters()
            self.update_dashboard_stats()
        except Exception as e: QMessageBox.critical(self, "导入失败", f"无法解析或处理ADIF文件。\n错误: {e}")
    def on_scan_clicked(self):
        self.hardware_view.enter_view()
        self.stacked_widget.setCurrentWidget(self.hardware_view)
    def on_inventory_update_clicked(self):
        """打开 QSL 卡片出入库更新对话框"""
        dialog = QSLInventoryUpdateDialog(self.db_manager, self)
        dialog.exec_()    
    def on_settings_clicked(self): dialog = SettingsDialog(self.db_manager, self); dialog.data_changed.connect(self.update_dashboard_stats); dialog.exec()
    def closeEvent(self, event): self.hardware_view.closeEvent(event); self.db_manager.close(); event.accept()
    def search_by_qsl_id(self, qsl_id):
        self.stacked_widget.setCurrentWidget(self.log_management_view); self.log_management_view.search_by_qsl_id(qsl_id)

# --- Database Manager ---
class DatabaseManager:
    def __init__(self, db_file):
        db_dir = os.path.dirname(db_file)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)
        self.conn = sqlite3.connect(db_file); self.conn.row_factory = sqlite3.Row; self.cursor = self.conn.cursor()
    def execute_query(self, query, params=()):
        try: self.cursor.execute(query, params); self.conn.commit(); return True
        except sqlite3.Error as e: print(f"Database error: {e}"); self.conn.rollback(); return False
    def fetch_one(self, query, params=()): self.cursor.execute(query, params); return self.cursor.fetchone()
    def fetch_all(self, query, params=()): self.cursor.execute(query, params); return self.cursor.fetchall()
    def get_all_my_callsigns(self): return [row['callsign'] for row in self.fetch_all("SELECT callsign FROM callsigns")]
    def add_callsign(self, callsign): return self.execute_query("INSERT OR IGNORE INTO callsigns (callsign) VALUES (?)", (callsign,))
    def delete_callsign(self, callsign): return self.execute_query("DELETE FROM callsigns WHERE callsign = ?", (callsign,))
    def add_log_entry(self, log_data):
        log_data['adif_blob'] = json.dumps(log_data)
        # 增加 qsl_sent_date 和 qsl_rcvd_date
        query = "INSERT INTO logs (my_callsign, station_callsign, qso_date, time_on, band, band_rx, freq, freq_rx, mode, rst_sent, rst_rcvd, comment, adif_blob, submode, sat_name, prop_mode, qsl_sent_date, qsl_rcvd_date) VALUES (:my_callsign, :station_callsign, :qso_date, :time_on, :band, :band_rx, :freq, :freq_rx, :mode, :rst_sent, :rst_rcvd, :comment, :adif_blob, :submode, :sat_name, :prop_mode, :qsl_sent_date, :qsl_rcvd_date)"
        # 确保字典中有这两个键，防止报错
        log_data.setdefault('qsl_sent_date', None)
        log_data.setdefault('qsl_rcvd_date', None)
        
        if self.execute_query(query, log_data):
            log_id = self.cursor.lastrowid
            self.execute_query("UPDATE logs SET sort_id = ? WHERE id = ?", (log_id, log_id))
            return log_id
        return None
    def update_log_entry(self, log_id, log_data):
        log_data['adif_blob'] = json.dumps(log_data); log_data['log_id'] = log_id
        # 增加 qsl_sent_date 和 qsl_rcvd_date 的更新
        query = "UPDATE logs SET station_callsign=:station_callsign, qso_date=:qso_date, time_on=:time_on, band=:band, band_rx=:band_rx, freq=:freq, freq_rx=:freq_rx, mode=:mode, rst_sent=:rst_sent, rst_rcvd=:rst_rcvd, comment=:comment, adif_blob=:adif_blob, submode=:submode, sat_name=:sat_name, prop_mode=:prop_mode, qsl_sent_date=:qsl_sent_date, qsl_rcvd_date=:qsl_rcvd_date WHERE id=:log_id"
        # 确保字典中有这两个键
        log_data.setdefault('qsl_sent_date', None)
        log_data.setdefault('qsl_rcvd_date', None)
        return self.execute_query(query, log_data)
    def add_qsl_card(self, qsl_id, log_ids: list, direction):
        try:
            now = datetime.datetime.now().isoformat()
            current_date_str = datetime.datetime.now().strftime('%Y%m%d') # ADIF 格式日期
            
            self.cursor.execute("INSERT INTO qsl_cards (qsl_id, direction, status, created_at) VALUES (?, ?, ?, ?)", (qsl_id, direction, 'In Stock', now))
            for log_id in log_ids: self.cursor.execute("INSERT INTO qsl_log_link (qsl_id, log_id) VALUES (?, ?)", (qsl_id, log_id))
            
            if direction == 'RC':
                # 收卡：更新状态为 Y，并设置收卡时间
                placeholders = ', '.join('?' for _ in log_ids)
                params = [current_date_str] + log_ids
                self.cursor.execute(f"UPDATE logs SET qsl_rcvd = 'Y', qsl_rcvd_date = ? WHERE id IN ({placeholders})", params)
            else:
                # 发卡：更新状态为 Y，并设置发卡时间
                placeholders = ', '.join('?' for _ in log_ids)
                params = [current_date_str] + log_ids
                self.cursor.execute(f"UPDATE logs SET qsl_sent = 'Y', qsl_sent_date = ? WHERE id IN ({placeholders})", params)
                
            self.conn.commit(); return True
        except sqlite3.Error as e: print(f"Error adding QSL card: {e}"); self.conn.rollback(); return False
    def get_log_details(self, log_id): return self.fetch_one("SELECT * FROM logs WHERE id = ?", (log_id,))
    def get_qsl_cards_for_log(self, log_id): return self.fetch_all("SELECT q.* FROM qsl_cards q JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id WHERE ql.log_id = ?", (log_id,))
    def get_logs_for_qsl_card(self, qsl_id): return self.fetch_all("SELECT log_id FROM qsl_log_link WHERE qsl_id = ?", (qsl_id,))
    def get_logs_for_qsl_id_prefix(self, qsl_id_prefix):
        return self.fetch_all("SELECT DISTINCT qsl_id FROM qsl_cards WHERE UPPER(qsl_id) LIKE ?", (f"{qsl_id_prefix.upper()}%",))

    def get_total_log_count(self): return self.fetch_one("SELECT COUNT(id) FROM logs")[0]
    def get_qsl_count(self, direction): return self.fetch_one("SELECT COUNT(qsl_id) FROM qsl_cards WHERE direction = ?", (direction,))[0]
    def get_recent_qsl_activity(self, limit=10): return self.fetch_all("SELECT q.direction, l.station_callsign FROM qsl_cards q JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id JOIN logs l ON ql.log_id = l.id GROUP BY q.qsl_id ORDER BY q.created_at DESC LIMIT ?", (limit,))
    def search_logs(self, station_callsign=None, my_callsign=None, mode=None, qsl_id=None):
        params = []; db_columns = ["l.id", "l.my_callsign", "l.station_callsign", "l.qso_date", "l.time_on", "l.band", "l.band_rx", "l.freq", "l.freq_rx", "l.mode", "l.qsl_sent", "l.qsl_rcvd", "l.comment"]
        col_string = ", ".join(db_columns); base_query = f"SELECT DISTINCT {col_string} FROM logs l"; joins = ""; conditions = " WHERE 1=1"
        if qsl_id and qsl_id.strip():
            joins += " JOIN qsl_log_link ql ON l.id = ql.log_id JOIN qsl_cards q ON ql.qsl_id = q.qsl_id"
            conditions += " AND UPPER(q.qsl_id) LIKE ?"
            params.append(f"{qsl_id.strip().upper()}%")
        if my_callsign and my_callsign.strip(): conditions += " AND l.my_callsign LIKE ?"; params.append(f"%{my_callsign.strip()}%")
        if station_callsign and station_callsign.strip(): conditions += " AND l.station_callsign LIKE ?"; params.append(f"%{station_callsign.strip()}%")
        if mode and mode != "全部模式": conditions += " AND l.mode = ?"; params.append(mode)
        final_query = base_query + joins + conditions + " ORDER BY l.sort_id DESC"
        return self.fetch_all(final_query, tuple(params))
    def log_exists(self, station_callsign, qso_date, time_on, band, mode):
        query = "SELECT id, time_on FROM logs WHERE UPPER(station_callsign)=? AND qso_date=? AND UPPER(band)=? AND UPPER(mode)=?"
        potential_duplicates = self.fetch_all(query, (station_callsign.upper(), qso_date, (band or "").upper(), (mode or "").upper()))
        if not potential_duplicates: return None
        try:
            new_qso_time_obj = datetime.datetime.strptime(time_on.zfill(6), '%H%M%S')
        except ValueError: return None
        time_window = datetime.timedelta(minutes=5)
        for row in potential_duplicates:
            try:
                existing_time_obj = datetime.datetime.strptime(row['time_on'].zfill(6), '%H%M%S')
                if abs(new_qso_time_obj - existing_time_obj) <= time_window:
                    return row['id']
            except ValueError: continue
        return None
    def find_all_duplicates(self):
        query = "SELECT station_callsign, qso_date, band, mode FROM logs GROUP BY UPPER(station_callsign), qso_date, UPPER(band), UPPER(mode) HAVING COUNT(id) > 1"
        candidate_groups = self.fetch_all(query)
        duplicate_sets = []
        time_window = datetime.timedelta(minutes=5)
        for group in candidate_groups:
            logs_in_group = self.fetch_all(
                "SELECT id, time_on FROM logs WHERE UPPER(station_callsign)=? AND qso_date=? AND UPPER(band)=? AND UPPER(mode)=? ORDER BY time_on",
                (group['station_callsign'].upper(), group['qso_date'], (group['band'] or "").upper(), (group['mode'] or "").upper())
            )
            if len(logs_in_group) < 2: continue

            visited_indices = set()
            for i in range(len(logs_in_group)):
                if i in visited_indices: continue
                current_set = {logs_in_group[i]['id']}
                try: time_i = datetime.datetime.strptime(logs_in_group[i]['time_on'].zfill(6), '%H%M%S')
                except (ValueError, AttributeError): continue

                for j in range(i + 1, len(logs_in_group)):
                    if j in visited_indices: continue
                    try:
                        time_j = datetime.datetime.strptime(logs_in_group[j]['time_on'].zfill(6), '%H%M%S')
                        if abs(time_j - time_i) <= time_window:
                            current_set.add(logs_in_group[j]['id']); visited_indices.add(j)
                    except (ValueError, AttributeError): continue
                if len(current_set) > 1:
                    duplicate_sets.append(current_set)
        return duplicate_sets
    def initialize_database(self):
        queries = [
            "CREATE TABLE IF NOT EXISTS callsigns (callsign TEXT PRIMARY KEY)",
            # 注意：下面的 CREATE TABLE logs 定义中增加了 qsl_sent_date 和 qsl_rcvd_date
            "CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, sort_id INTEGER, my_callsign TEXT, station_callsign TEXT, qso_date TEXT, time_on TEXT, band TEXT, band_rx TEXT, freq REAL, freq_rx REAL, mode TEXT, submode TEXT, rst_sent TEXT, rst_rcvd TEXT, comment TEXT, adif_blob TEXT, qsl_sent TEXT DEFAULT 'N', qsl_rcvd TEXT DEFAULT 'N', sat_name TEXT, prop_mode TEXT, qsl_sent_date TEXT, qsl_rcvd_date TEXT)",
            "CREATE TABLE IF NOT EXISTS qsl_cards (qsl_id TEXT PRIMARY KEY, direction TEXT NOT NULL, status TEXT, location TEXT, created_at TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS qsl_log_link (qsl_id TEXT NOT NULL, log_id INTEGER NOT NULL, PRIMARY KEY (qsl_id, log_id), FOREIGN KEY (qsl_id) REFERENCES qsl_cards (qsl_id) ON DELETE CASCADE, FOREIGN KEY (log_id) REFERENCES logs (id) ON DELETE CASCADE)"
        ]
        try:
            for query in queries:
                self.cursor.execute(query)
            self.conn.commit()
        except sqlite3.Error as e:
            print(f"Database initialization error: {e}")
            self.conn.rollback()

        # --- 新增：数据库迁移逻辑 (检查并添加新字段，处理旧数据) ---
        try:
            self.cursor.execute("SELECT qsl_sent_date FROM logs LIMIT 1")
        except sqlite3.OperationalError:
            # 如果字段不存在，则添加
            print("Detected old database version. Migrating schema...")
            try:
                self.execute_query("ALTER TABLE logs ADD COLUMN qsl_sent_date TEXT")
                self.execute_query("ALTER TABLE logs ADD COLUMN qsl_rcvd_date TEXT")
                
                # 迁移旧数据：如果已发卡/收卡但没有日期，默认使用 QSO 日期
                self.execute_query("UPDATE logs SET qsl_sent_date = qso_date WHERE qsl_sent = 'Y' AND (qsl_sent_date IS NULL OR qsl_sent_date = '')")
                self.execute_query("UPDATE logs SET qsl_rcvd_date = qso_date WHERE qsl_rcvd = 'Y' AND (qsl_rcvd_date IS NULL OR qsl_rcvd_date = '')")
                self.conn.commit()
                print("Schema migration and data backfill completed.")
            except sqlite3.Error as e:
                print(f"Migration failed: {e}")
        # --------------------------------------------------------

        try:
            self.cursor.execute("SELECT sort_id FROM logs LIMIT 1")
        except sqlite3.OperationalError:
            self.execute_query("ALTER TABLE logs ADD COLUMN sort_id INTEGER")
            self.execute_query("UPDATE logs SET sort_id = id")

    def reorder_logs_by_time(self):
        try:
            logs = self.fetch_all("SELECT id, qso_date, time_on FROM logs ORDER BY qso_date, time_on")
            for new_index, log in enumerate(logs):
                self.execute_query("UPDATE logs SET sort_id = ? WHERE id = ?", (new_index + 1, log['id']))
            return True
        except sqlite3.Error as e:
            print(f"Error reordering logs: {e}")
            return False
    def delete_log(self, log_id):
        self.execute_query("DELETE FROM qsl_log_link WHERE log_id = ?", (log_id,))
        return self.execute_query("DELETE FROM logs WHERE id = ?", (log_id,))
    def recycle_qsl_card(self, log_id, direction):
        qsl_id_row = self.fetch_one("SELECT q.qsl_id FROM qsl_cards q JOIN qsl_log_link ql ON q.qsl_id = ql.qsl_id WHERE ql.log_id = ? AND q.direction = ?", (log_id, direction))
        if not qsl_id_row: return False
        qsl_id = qsl_id_row['qsl_id']
        status_field = "qsl_rcvd" if direction == 'RC' else "qsl_sent"
        self.execute_query(f"UPDATE logs SET {status_field} = 'N' WHERE id = ?", (log_id,))
        self.execute_query("DELETE FROM qsl_log_link WHERE qsl_id = ? AND log_id = ?", (qsl_id, log_id))
        is_linked_elsewhere = self.fetch_one("SELECT 1 FROM qsl_log_link WHERE qsl_id = ?", (qsl_id,))
        if not is_linked_elsewhere: self.execute_query("DELETE FROM qsl_cards WHERE qsl_id = ?", (qsl_id,))
        return True
    def update_qsl_card_date(self, qsl_id):
        """
        根据QSL ID查询关联的日志，并更新对应的收/发卡日期为当前日期。
        如果数据库中的日期与当前日期不一致，则强制更新。
        返回 (成功与否, 消息)。
        """
        print(f"\n--- DEBUG: Starting QSL Update for ID: {qsl_id} ---")
        current_date_str = datetime.datetime.now().strftime("%Y%m%d")
        
        # 1. 查询 qsl_cards 表以获取卡片方向 (TC/RC)
        card_row = self.fetch_one("SELECT direction FROM qsl_cards WHERE qsl_id = ?", (qsl_id,))
        if not card_row:
            print("--- DEBUG: Failure: QSL ID not found in qsl_cards.")
            return False, "卡片ID不存在，请检查输入。"

        # 假设 fetch_one 返回的是元组，方向在索引 0
        direction = card_row[0] if isinstance(card_row, tuple) else card_row['direction']
        print(f"--- DEBUG: QSL Card Direction: {direction} ---")
        
        # 2. 确定要更新的字段和动作文本
        if direction == 'TC': 
            update_field = "qsl_sent_date"
            check_field = "qsl_sent_date"
            action_text = "标记为已寄出"
        elif direction == 'RC':
            update_field = "qsl_rcvd_date"
            check_field = "qsl_rcvd_date"
            action_text = "标记为已收到"
        else:
            print("--- DEBUG: Failure: Unknown direction.")
            return False, f"卡片方向 ({direction}) 未知。"
            
        # 3. 查找所有关联的 log_id 和对应的当前日期状态
        log_data = self.fetch_all(f"""
            SELECT l.id, l.{check_field}
            FROM logs l
            JOIN qsl_log_link qll ON l.id = qll.log_id
            WHERE qll.qsl_id = ?
        """, (qsl_id,))

        if not log_data:
            print("--- DEBUG: Failure: No associated logs found.")
            return False, "未找到该卡片ID关联的通联日志。"
        
        print(f"--- DEBUG: Found {len(log_data)} associated logs.")

        # 4. 检查是否需要更新：只有在日期已记录且与当前日期一致时，才跳过更新
        first_log_date = None
        for row in log_data:
            # 假设 fetch_all 返回的是元组列表，日期在索引 1
            date_value = row[1]
            if date_value:
                first_log_date = date_value
                break
                
        if first_log_date:
            if first_log_date == current_date_str:
                # 日期一致，无需更新
                print(f"--- DEBUG: Already Processed Today ({first_log_date}). Aborting update.")
                return True, f"卡片已于今日 ({first_log_date}) 完成处理，无需重复更新。"
            else:
                # 日期不一致 (例如 20251201 != 20251213)，继续执行更新
                print(f"--- DEBUG: Already Processed on {first_log_date}. Date is stale, forcing update to {current_date_str}.")
                # 流程继续到 Step 5 (更新)
        else:
            # 尚未处理，继续执行更新
            print("--- DEBUG: Not yet processed. Proceeding to update.")
            
        # 5. 执行批量更新
        log_ids_to_update = [row[0] for row in log_data]
        placeholders = ','.join('?' for _ in log_ids_to_update)
        update_query = f"UPDATE logs SET {update_field} = ? WHERE id IN ({placeholders})"
        params = [current_date_str] + log_ids_to_update
        
        if self.execute_query(update_query, params):
            print("--- DEBUG: Success: Database updated.")
            return True, f"卡片已成功 {action_text} (日期: {current_date_str})。已更新 {len(log_ids_to_update)} 条日志记录。"
        else:
            print("--- DEBUG: Failure: execute_query returned False.")
            return False, "数据库更新失败。"
    
    def reset_all_qsl_data(self):
        try:
            self.execute_query("DELETE FROM qsl_log_link")
            self.execute_query("DELETE FROM qsl_cards")
            self.execute_query("UPDATE logs SET qsl_sent = 'N', qsl_rcvd = 'N'")
            return True
        except:
            return False
    def close(self): self.conn.close(); print("Database connection closed.")

# --- QSL ID Generator ---
class QSL_ID_Generator:
    @staticmethod
    def get_next_serial(db_manager, id_type):
        last_id_row = db_manager.fetch_one("SELECT qsl_id FROM qsl_cards WHERE direction = ? ORDER BY created_at DESC, qsl_id DESC LIMIT 1", (id_type,))
        if last_id_row:
            last_id = last_id_row['qsl_id']; last_year = last_id[0:2]; current_year = datetime.datetime.now().strftime('%y')
            if last_year == current_year: return int(last_id[2:8]) + 1
        return 1
    @staticmethod
    def generate(db_manager, id_type):
        if id_type not in ['RC', 'TC']: raise ValueError("Type must be 'RC' or 'TC'")
        year = datetime.datetime.now().strftime('%y'); serial = QSL_ID_Generator.get_next_serial(db_manager, id_type)
        random_hex = secrets.token_hex(8); return f"{year}{serial:06d}{id_type}{random_hex.upper()}"

if __name__ == '__main__':
    app = QApplication(sys.argv)

    missing_libs = []
    try: import adif_io
    except ImportError: missing_libs.append('adif-io')
    try: import qrcode
    except ImportError: missing_libs.append('qrcode')
    try: from reportlab.pdfgen import canvas
    except ImportError: missing_libs.append('reportlab')
    try: from PIL import Image
    except ImportError: missing_libs.append('Pillow')
    try: import fitz
    except ImportError: missing_libs.append('PyMuPDF')
    try: import serial
    except ImportError: missing_libs.append('pyserial')


    if missing_libs:
        QMessageBox.critical(None, "缺少依赖库", f"检测到缺少以下必要的库:\n\n{', '.join(missing_libs)}\n\n请在终端中运行 'pip install --upgrade <library_name>' 来安装或更新它们。")
        sys.exit(1)

    os.makedirs("assets", exist_ok=True)
    with open(STYLE_SHEET_FILE, "w", encoding="utf-8") as f:
        f.write("""
    QMainWindow, QDialog, QWidget { background-color: #2c3e50; color: #ecf0f1; font-size: 26px; }
    QWidget#dashboard_view { background-color: #34495e; }
    QGroupBox { border: 1px solid #7f8c8d; border-radius: 5px; margin-top: 1ex; }
    QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top center; padding: 0 3px; }
    QPushButton, QComboBox { background-color: #3498db; color: #ffffff; border: 1px solid #2980b9; border-radius: 4px; padding: 8px; min-height: 20px; }
    QPushButton:hover { background-color: #4aa3df; }
    QPushButton:pressed { background-color: #2980b9; }
    QPushButton#tileButton { background-color: #2c3e50; border: 2px solid #3498db; border-radius: 10px; padding: 20px; font-size: 30px; font-weight: bold; }
    QPushButton#tileButton:hover { background-color: #3498db; color: #ffffff; }
    QPushButton#quitButton { background-color: #c0392b; border: 2px solid #e74c3c; border-radius: 10px; padding: 20px; font-size: 30px; font-weight: bold; }
    QPushButton#quitButton:hover { background-color: #e74c3c; }
    QLineEdit, QDateEdit, QTextEdit, QListWidget, QSpinBox, QCheckBox { background-color: #2c3e50; border: 1px solid #7f8c8d; border-radius: 4px; padding: 8px; color: #ecf0f1; }
    QCheckBox { border: none; }
    QLineEdit:read-only { background-color: #34495e; }
    QFrame { border: 1px solid #7f8c8d; border-radius: 5px; }
    QTableView { border: 1px solid #7f8c8d; gridline-color: #7f8c8d; }
    QTableView::item { padding: 5px; }
    QTableView::item:alternate { background-color: #34495e; }
    QHeaderView::section { background-color: #3498db; color: white; padding: 5px; border: 1px solid #2980b9; font-weight: bold; }
    QDialog { border: 1px solid #7f8c8d; }
    QLabel#statsHeader { font-size: 16px; font-weight: bold; color: #3498db; margin-top: 10px; border: none; }
    QListWidget { border: none; }
    QSplitter::handle { background-color: #7f8c8d; }
    """)
    main_win = MainWindow()
    main_win.showMaximized()
    app.exec()
