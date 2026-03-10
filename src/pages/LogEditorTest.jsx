import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const LogEditorTest = () => {
  return (
    <div>
      <Card>
        <Title level={2}>新建日志测试页面</Title>
        <p>如果您能看到这个页面，说明路由和基本渲染是正常的。</p>
        <p>问题可能出在LogEditor组件的某个部分。</p>
      </Card>
    </div>
  );
};

export default LogEditorTest;
