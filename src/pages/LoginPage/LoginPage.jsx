import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Spin, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../AuthContext'; // Sesuaikan path
import { useNavigate, useLocation } from 'react-router-dom';

const { Title } = Typography;

const LoginPage = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get the location users were trying to access before being redirected to login
    const from = location.state?.from?.pathname || '/mutasi'; // Default redirect after login

    const handleLogin = async (values) => {
        const { email, password } = values;
        setError(''); // Clear previous errors
        setLoading(true);

        try {
            console.log("Attempting login for:", email);
            await login(email, password);
            console.log("Login successful, navigating to:", from);
            navigate(from, { replace: true }); // Redirect to original destination or default
        } catch (err) {
            console.error("Login failed:", err.code, err.message);
            let errorMessage = "Gagal login. Periksa kembali email dan password Anda.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                errorMessage = "Email atau password salah.";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "Format email tidak valid.";
            } else if (err.code === 'auth/too-many-requests') {
                 errorMessage = "Terlalu banyak percobaan login. Coba lagi nanti.";
            }
            // Add more specific error handling if needed
            setError(errorMessage);
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    {/* Optional: Add your logo here */}
                    {/* <img src="/path/to/your/logo.png" alt="Logo" style={{ height: '50px', marginBottom: '10px' }} /> */}
                    <Title level={3}>Login Aplikasi</Title>
                </div>
                <Spin spinning={loading} tip="Memproses login...">
                    <Form
                        form={form}
                        name="login_form"
                        onFinish={handleLogin}
                        autoComplete="off"
                    >
                        {error && (
                            <Form.Item>
                                <Alert message={error} type="error" showIcon closable onClose={() => setError('')}/>
                            </Form.Item>
                        )}
                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: 'Masukkan email Anda!' },
                                { type: 'email', message: 'Format email tidak valid!' }
                            ]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="Email" size="large"/>
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Masukkan password Anda!' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large"/>
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} size="large">
                                Login
                            </Button>
                        </Form.Item>
                    </Form>
                </Spin>
            </Card>
        </Layout>
    );
};

export default LoginPage;
