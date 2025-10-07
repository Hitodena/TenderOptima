import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import { Link } from 'wouter';

interface User {
  id: number;
  username: string;
  emailAccount?: string;
  emailConfigured?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
}

interface EmailConfig {
  emailAccount: string;
  emailPassword: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  requestsLimit: number;
  requestsUsed: number;
  username: string;
  userRole: string;
}

export default function AdminEmailPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    emailAccount: '',
    emailPassword: '',
    smtpHost: 'smtp.mail.ru',
    smtpPort: 587,
    imapHost: 'imap.mail.ru',
    imapPort: 993
  });

  // Check admin access
  if (!user || user.role !== 'admin') {
    console.error('Unauthorized access attempt to admin panel');
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-lg font-medium text-red-800 mb-2">Доступ запрещен</h2>
          <p className="text-red-700">У вас нет прав для доступа к админ-панели.</p>
        </div>
      </div>
    );
  }

  console.log('Admin panel accessed by admin user:', user.username);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subscriptions
        const subsResponse = await fetch('/api/admin/email/subscriptions', {
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (subsResponse.ok) {
          const subsData = await subsResponse.json();
          console.log('Fetched subscriptions:', subsData);
          setSubscriptions(subsData);
        }

        // Fetch users
        const usersResponse = await fetch('/api/admin/email/users', {
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('Fetched users:', usersData);
          setUsers(usersData);
        }

      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditUser = async (userId: number) => {
    if (editingUser === userId) {
      // Save configuration
      try {
        const response = await fetch(`/api/admin/email/users/${userId}/config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(emailConfig)
        });

        if (response.ok) {
          // Refresh users data
          const usersResponse = await fetch('/api/admin/email/users', {
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
          }
          
          setEditingUser(null);
          setEmailConfig({
            emailAccount: '',
            emailPassword: '',
            smtpHost: 'smtp.mail.ru',
            smtpPort: 587,
            imapHost: 'imap.mail.ru',
            imapPort: 993
          });
          alert('Email настройки сохранены успешно!');
        } else {
          alert('Ошибка при сохранении настроек');
        }
      } catch (error) {
        console.error('Error saving email config:', error);
        alert('Ошибка при сохранении настроек');
      }
    } else {
      // Start editing
      const userToEdit = users.find(u => u.id === userId);
      if (userToEdit) {
        setEmailConfig({
          emailAccount: userToEdit.emailAccount || '',
          emailPassword: '', // Don't load password for security
          smtpHost: userToEdit.smtpHost || 'smtp.mail.ru',
          smtpPort: userToEdit.smtpPort || 587,
          imapHost: userToEdit.imapHost || 'imap.mail.ru',
          imapPort: userToEdit.imapPort || 993
        });
        setEditingUser(userId);
      }
    }
  };

  const handleResetConfig = async (userId: number) => {
    if (confirm('Вы уверены, что хотите сбросить email настройки для этого пользователя?')) {
      try {
        const response = await fetch(`/api/admin/email/users/${userId}/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (response.ok) {
          // Refresh users data
          const usersResponse = await fetch('/api/admin/email/users', {
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
          }
          alert('Email настройки сброшены успешно!');
        } else {
          alert('Ошибка при сбросе настроек');
        }
      } catch (error) {
        console.error('Error resetting email config:', error);
        alert('Ошибка при сбросе настроек');
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Админ-панель управления email</h1>
        <div className="flex gap-4">
          <Link 
            href="/admin/unprocessed-emails"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Неразобранные письма
          </Link>
          <Link 
            href="/admin/email-templates"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Шаблоны ответов
          </Link>
        </div>
      </div>
      
      {/* Subscriptions section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Управление подпиской</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тарифный план</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус подписки</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата начала</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата окончания</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Лимит запросов</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Использовано запросов</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{subscription.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{subscription.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {subscription.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {subscription.status === 'active' ? 'Активна' : 'Неактивна'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {subscription.startDate ? new Date(subscription.startDate).toLocaleDateString('ru-RU') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString('ru-RU') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{subscription.requestsLimit}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{subscription.requestsUsed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-indigo-600 hover:text-indigo-900">Редактировать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users email management section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Управление email пользователей</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email аккаунт</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пароль</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMTP настройки</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((userItem) => (
                <tr key={userItem.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userItem.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userItem.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === userItem.id ? (
                      <input
                        type="email"
                        value={emailConfig.emailAccount}
                        onChange={(e) => setEmailConfig({...emailConfig, emailAccount: e.target.value})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="email@example.com"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">{userItem.emailAccount || '-'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === userItem.id ? (
                      <input
                        type="password"
                        value={emailConfig.emailPassword}
                        onChange={(e) => setEmailConfig({...emailConfig, emailPassword: e.target.value})}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Пароль"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">{userItem.emailAccount ? '••••••••' : '-'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === userItem.id ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={emailConfig.smtpHost}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpHost: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="SMTP хост"
                        />
                        <input
                          type="number"
                          value={emailConfig.smtpPort}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpPort: parseInt(e.target.value)})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="SMTP порт"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-900">
                        {userItem.smtpHost ? `${userItem.smtpHost}:${userItem.smtpPort}` : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userItem.emailConfigured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {userItem.emailConfigured ? 'Настроен' : 'Не настроен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(userItem.id)}
                        className={`px-3 py-1 text-xs rounded ${
                          editingUser === userItem.id
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {editingUser === userItem.id ? 'Сохранить' : 'Редактировать'}
                      </button>
                      {editingUser === userItem.id && (
                        <button
                          onClick={() => setEditingUser(null)}
                          className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Отмена
                        </button>
                      )}
                      {userItem.emailConfigured && (
                        <button
                          onClick={() => handleResetConfig(userItem.id)}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}