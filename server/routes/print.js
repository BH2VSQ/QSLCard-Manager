import express from 'express';
import { db } from '../db/database.js';
import { printQueue, queueIdCounter } from './qsl.js';
import { generateQSLPrintHTML, generateAddressPrintHTML, generateAddressBatchPrintHTML } from '../services/printService.js';

const router = express.Router();

/**
 * 添加到打印队列
 * POST /api/print/queue
 */
router.post('/queue', (req, res) => {
  try {
    const { type, qsl_id, layout, log_ids, sender, receiver } = req.body;

    if (!type || !['qsl_label', 'address_label'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    let queueItem = {
      id: queueIdCounter.value++,
      type,
      qsl_id,
      layout,
      log_ids,
      sender,
      receiver,
      status: 'ready',
      created_at: new Date().toISOString()
    };

    // 如果是QSL标签，获取日志数据
    if (type === 'qsl_label' && qsl_id) {
      const logs = db.prepare(`
        SELECT l.* FROM logs l
        JOIN qsl_log_link ll ON l.id = ll.log_id
        WHERE ll.qsl_id = ?
        ORDER BY l.qso_date, l.time_on
      `).all(qsl_id);
      queueItem.logs = logs;
    }

    printQueue.push(queueItem);

    res.status(201).json({
      success: true,
      data: queueItem,
      message: 'Added to print queue'
    });
  } catch (error) {
    console.error('Add to queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取打印队列
 * GET /api/print/queue
 */
router.get('/queue', (req, res) => {
  try {
    res.json({ success: true, data: printQueue });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 调试地址标签批量打印 - 简化版本
 * GET /api/print/debug-address-batch
 */
router.get('/debug-address-batch', (req, res) => {
  try {
    // 创建3个简单的地址标签
    const simpleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Debug Address Batch Print</title>
        <style>
          @page {
            size: 70mm 50mm;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          
          .address-page {
            width: 70mm;
            height: 50mm;
            border: 1px solid red;
            display: block;
            position: relative;
            background: white;
          }
          
          .address-content {
            padding: 5mm;
          }
          
          .debug-info {
            position: absolute;
            top: 2mm;
            right: 2mm;
            font-size: 8pt;
            color: red;
          }
          
          @media print {
            .address-page {
              border: none;
            }
            .debug-info {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="address-page">
          <div class="debug-info">Page 1</div>
          <div class="address-content">
            <h3>FROM(发自):</h3>
            <p>110000</p>
            <p>辽宁省沈阳市6010邮政信箱</p>
            <p><strong>BH2VSQ</strong></p>
            <p>TEL: 15502424829</p>
          </div>
        </div>
        
        <div class="address-page" style="page-break-before: always;">
          <div class="debug-info">Page 2</div>
          <div class="address-content">
            <h3>TO(发往):</h3>
            <p>100020</p>
            <p>北京市朝阳区建国路88号</p>
            <p><strong>BH1ABC</strong></p>
            <p>TEL: 13800138000</p>
          </div>
        </div>
        
        <div class="address-page" style="page-break-before: always;">
          <div class="debug-info">Page 3</div>
          <div class="address-content">
            <h3>FROM(发自):</h3>
            <p>200120</p>
            <p>上海市浦东新区陆家嘴环路1000号</p>
            <p><strong>BH3XYZ</strong></p>
            <p>TEL: 13900139000</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Generated debug address batch HTML, length: ${simpleHTML.length}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(simpleHTML);
  } catch (error) {
    console.error('Debug address batch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取打印HTML内容
 * GET /api/print/html/:queue_id
 */
router.get('/html/:queue_id', async (req, res) => {
  try {
    const queueId = parseInt(req.params.queue_id);
    console.log(`Getting HTML for queue ID: ${queueId}`);
    
    const item = printQueue.find(q => q.id === queueId);

    if (!item) {
      console.log(`Queue item not found: ${queueId}`);
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }

    console.log(`Found queue item:`, item);

    let htmlContent;

    if (item.type === 'qsl_label') {
      if (!item.qsl_id || !item.logs) {
        console.log('Missing QSL data:', { qsl_id: item.qsl_id, logs: item.logs?.length });
        return res.status(400).json({ success: false, error: 'QSL data not found' });
      }
      console.log(`Generating QSL HTML for ${item.qsl_id} with ${item.logs.length} logs, layout ${item.layout}`);
      htmlContent = await generateQSLPrintHTML(item.qsl_id, item.logs, item.layout || 1);
    } else if (item.type === 'address_label') {
      // 地址标签单页打印 - 每次打印一张标签
      const addressData = item.sender || item.receiver;
      if (!addressData) {
        return res.status(400).json({ success: false, error: 'Address data required' });
      }
      
      // 直接传递地址数据，函数内部会处理格式
      htmlContent = generateAddressPrintHTML(addressData);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    console.log(`Generated HTML content length: ${htmlContent.length}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('Generate HTML error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量获取打印HTML内容 - 支持同类型标签合并打印
 * POST /api/print/html/batch
 */
router.post('/html/batch', async (req, res) => {
  try {
    const { queue_ids } = req.body;

    if (!queue_ids || !Array.isArray(queue_ids)) {
      return res.status(400).json({ success: false, error: 'Invalid queue_ids' });
    }

    console.log(`Starting batch print for ${queue_ids.length} items: [${queue_ids.join(', ')}]`);
    console.log(`Print queue contains ${printQueue.length} total items`);

    // 收集所有CSS样式和页面内容
    let allStyles = new Set();
    let allPages = [];
    let totalPageCount = 0;
    let itemSummary = [];
    let batchType = null;
    let addressDataArray = []; // 专门收集地址数据用于批量处理

    for (let i = 0; i < queue_ids.length; i++) {
      const queueId = queue_ids[i];
      const item = printQueue.find(q => q.id === queueId);
      if (!item) {
        console.log(`Queue item ${queueId} not found, skipping`);
        continue;
      }

      console.log(`Processing queue item ${queueId}:`, {
        type: item.type,
        hasSender: !!item.sender,
        hasReceiver: !!item.receiver,
        senderData: item.sender ? Object.keys(item.sender) : null,
        receiverData: item.receiver ? Object.keys(item.receiver) : null
      });

      // 检查批量打印类型一致性
      if (batchType === null) {
        batchType = item.type;
        console.log(`Batch print type determined: ${batchType}`);
      } else if (batchType !== item.type) {
        console.error(`Type mismatch: expected ${batchType}, got ${item.type} for queue ${queueId}`);
        return res.status(400).json({ 
          success: false, 
          error: `Cannot mix different types in batch print. Expected ${batchType}, got ${item.type}` 
        });
      }

      // 对于地址标签，收集地址数据用于批量处理
      if (item.type === 'address_label') {
        const addressData = item.sender || item.receiver;
        if (addressData) {
          addressDataArray.push(addressData);
          itemSummary.push({
            queueId,
            type: item.type,
            info: `Address (${addressData.type || (item.sender ? 'sender' : 'receiver')})`,
            pages: 1
          });
          totalPageCount += 1;
        }
        continue; // 跳过单独处理，等待批量处理
      }

      // 对于QSL标签，继续单独处理
      let itemHTML = '';
      let itemInfo = `${item.type}`;
      
      try {
        if (item.type === 'qsl_label' && item.qsl_id && item.logs) {
          console.log(`Generating QSL HTML for ${item.qsl_id} (Layout ${item.layout || 1}, ${item.logs.length} logs)`);
          itemHTML = await generateQSLPrintHTML(item.qsl_id, item.logs, item.layout || 1);
          itemInfo = `QSL-${item.qsl_id} (Layout ${item.layout || 1}, ${item.logs.length} logs)`;
        }
      } catch (error) {
        console.error(`Error generating HTML for queue ${queueId}:`, error);
        continue;
      }

      if (itemHTML) {
        console.log(`Generated HTML for queue ${queueId}, length: ${itemHTML.length}`);
        
        // 提取CSS样式
        const styleMatch = itemHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
          allStyles.add(styleMatch[1]);
          console.log(`Added CSS styles for queue ${queueId}`);
        }

        // 提取body内容
        const bodyMatch = itemHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          let bodyContent = bodyMatch[1];
          console.log(`Extracted body content for queue ${queueId}, length: ${bodyContent.length}`);
          
          // 为QSL标签添加分页符（除第一个）
          if (totalPageCount > 0) {
            console.log(`Adding page break for QSL item ${queueId} (position ${i + 1})`);
            
            if (bodyContent.includes('class="qsl-page"')) {
              // QSL标签：为第一个qsl-page添加分页符
              let firstPageProcessed = false;
              bodyContent = bodyContent.replace(
                /<div([^>]*class="qsl-page"[^>]*?)(\s+style="([^"]*)")?(\s*>)/g,
                (match, divAttributes, styleAttr, styleContent, divEnd) => {
                  if (!firstPageProcessed) {
                    firstPageProcessed = true;
                    // 为第一页添加分页符
                    if (styleAttr && styleContent) {
                      // 已有style属性，检查是否已有分页符
                      if (styleContent.includes('page-break-before')) {
                        return match; // 已有分页符，保持不变
                      } else {
                        const newStyle = styleContent + '; page-break-before: always;';
                        return `<div${divAttributes} style="${newStyle}"${divEnd}`;
                      }
                    } else {
                      // 没有style属性，创建新的
                      return `<div${divAttributes} style="page-break-before: always;"${divEnd}`;
                    }
                  } else {
                    // 其他页面保持原样
                    return match;
                  }
                }
              );
              console.log(`Added page break to QSL item ${queueId}`);
            }
          } else {
            console.log(`First item ${queueId}, no page break needed`);
          }
          
          allPages.push(bodyContent);
          console.log(`Added page content for queue ${queueId}, total pages so far: ${allPages.length}`);
          
          // 精确计算页面数量
          const qslPageMatches = bodyContent.match(/class="qsl-page"/g);
          const currentItemPages = qslPageMatches ? qslPageMatches.length : 1;
          
          totalPageCount += currentItemPages;
          itemSummary.push({
            queueId,
            type: item.type,
            info: itemInfo,
            pages: currentItemPages
          });
          
          console.log(`QSL Item ${queueId} (${itemInfo}): ${currentItemPages} pages, total: ${totalPageCount}`);
        } else {
          console.error(`Failed to extract body content from HTML for queue ${queueId}`);
        }
      } else {
        console.log(`No HTML generated for queue ${queueId}`);
      }
    }

    // 处理地址标签批量打印
    if (batchType === 'address_label' && addressDataArray.length > 0) {
      console.log(`Generating batch address HTML for ${addressDataArray.length} labels`);
      
      try {
        const batchHTML = generateAddressBatchPrintHTML(addressDataArray);
        console.log(`Generated batch address HTML, length: ${batchHTML.length}`);
        
        // 提取CSS样式
        const styleMatch = batchHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
          allStyles.add(styleMatch[1]);
          console.log(`Added batch address CSS styles`);
        }

        // 提取body内容
        const bodyMatch = batchHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          const bodyContent = bodyMatch[1];
          allPages.push(bodyContent);
          console.log(`Added batch address content, total pages: ${allPages.length}`);
        }
      } catch (error) {
        console.error('Error generating batch address HTML:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate batch address HTML' });
      }
    }

    if (allPages.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid content to print' });
    }

    // 合并所有样式，确保没有重复
    const combinedStyles = Array.from(allStyles).join('\n\n');

    // 根据批量打印类型设置标题
    const batchTypeDisplayName = batchType === 'qsl_label' ? 'QSL' : 'Address';

    // 生成完整的HTML
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${batchTypeDisplayName} Batch Print - ${allPages.length} items, ${totalPageCount} pages</title>
        <style>
          ${combinedStyles}
          
          /* 批量打印优化 */
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* 确保字体正确加载 */
            @font-face {
              font-family: 'MapleMono';
              src: url('/MapleMonoNL-Regular.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'ChineseFont';
              src: url('/Cinese.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
          }
        </style>
      </head>
      <body>
        ${allPages.join('')}
      </body>
      </html>
    `;

    // 详细的批量打印摘要
    console.log(`=== ${batchTypeDisplayName} Batch Print Summary ===`);
    console.log(`Batch type: ${batchType}`);
    console.log(`Total items processed: ${allPages.length}`);
    console.log(`Total pages: ${totalPageCount}`);
    console.log(`Final HTML length: ${combinedHTML.length} characters`);
    console.log(`Items summary:`);
    itemSummary.forEach((item, index) => {
      console.log(`  ${index + 1}. Queue ${item.queueId}: ${item.info} - ${item.pages} pages`);
    });
    
    // 输出最终HTML的前1000个字符用于调试
    console.log(`Final HTML preview (first 1000 chars):`);
    console.log(combinedHTML.substring(0, 1000));
    
    // 计算实际的address-page数量
    const finalAddressPageCount = (combinedHTML.match(/class="address-page"/g) || []).length;
    console.log(`Final HTML contains ${finalAddressPageCount} address-page elements`);
    
    console.log(`=== End Summary ===`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(combinedHTML);
  } catch (error) {
    console.error('Batch HTML error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量生成 HTML
 * POST /api/print/generate/batch
 */
router.post('/generate/batch', async (req, res) => {
  try {
    const { queue_ids } = req.body;

    if (!queue_ids || !Array.isArray(queue_ids)) {
      return res.status(400).json({ success: false, error: 'Invalid queue_ids' });
    }

    const results = [];
    const errors = [];

    for (const queueId of queue_ids) {
      try {
        const item = printQueue.find(q => q.id === queueId);
        if (!item) {
          errors.push({ queue_id: queueId, error: 'Queue item not found' });
          continue;
        }

        // 数据已经在队列中，直接标记为可打印
        item.status = 'ready';
        results.push({ queue_id: queueId, status: 'ready' });
      } catch (error) {
        errors.push({ queue_id: queueId, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Prepared ${results.length} items for printing${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    });
  } catch (error) {
    console.error('Batch prepare error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 从队列移除
 * DELETE /api/print/queue/:id
 */
router.delete('/queue/:id', (req, res) => {
  try {
    const queueId = parseInt(req.params.id);
    const index = printQueue.findIndex(q => q.id === queueId);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }

    printQueue.splice(index, 1);

    res.json({ success: true, message: 'Removed from queue' });
  } catch (error) {
    console.error('Remove from queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 清空队列
 * DELETE /api/print/queue
 */
router.delete('/queue', (req, res) => {
  try {
    printQueue.length = 0; // 清空数组但保持引用
    queueIdCounter.value = 1; // 重置计数器

    res.json({ success: true, message: 'Queue cleared' });
  } catch (error) {
    console.error('Clear queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
