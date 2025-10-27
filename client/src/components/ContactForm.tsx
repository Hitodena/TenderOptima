import { useState, useEffect } from 'react';
import { useLanguage } from "@/contexts/language-context";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PaperclipIcon, X, FilePlus, Loader2, UserIcon, Mail, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Extended UserData interface for TypeScript compatibility
interface UserData {
  id: number;
  username: string;
  email?: string;
  claims?: {
    email: string;
    sub?: string;
    name?: string;
  };
}

// Define the interface for a manager
interface Manager {
  name?: string;
  position?: string;
  email?: string;
  phone?: string;
}

// Custom hook to get user's assigned manager info
const useUserManager = () => {
  const [manager, setManager] = useState<Manager>({
    name: 'Служба поддержки',
    email: 'support@tenderoptima.by',
    phone: '+375 29 123 45 67'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const fetchManagerInfo = async () => {
      setIsLoading(true);
      try {
        // Get token from various possible storage locations for consistent auth
        const token = localStorage.getItem('accessToken') || 
                      localStorage.getItem('token') || 
                      sessionStorage.getItem('token') ||
                      localStorage.getItem('tenderOptima_token');
        
        const response = await fetch('/api/contact/manager-info', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Requested-With': 'XMLHttpRequest',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setManager(data);
        }
      } catch (error) {
        console.error('Error fetching manager info:', error);
        // Fallback to default manager info is already set in state
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchManagerInfo();
  }, []);
  
  return { manager, isLoading };
};

function ContactForm() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth() as { user: UserData | undefined };
  const { manager } = useUserManager();
  
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('message', formData.message);
      
      // Get user email from any available source for inclusion in message content
      let userEmail = '';
      if (user) {
        if (typeof user.email === 'string') {
          userEmail = user.email;
        } else if (user.claims && typeof user.claims.email === 'string') {
          userEmail = user.claims.email;
        }
      }
      
      if (userEmail) {
        formDataToSend.append('userEmail', userEmail);
      }
      
      if (user && user.username) {
        formDataToSend.append('userName', user.username);
      }
      
      // Append all files
      files.forEach(file => {
        formDataToSend.append('attachments', file);
      });
      
      console.log("Sending contact form message with attachments");
      
      // No authorization required - public contact form
      const response = await fetch('/api/contact/send-message', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formDataToSend,
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      // Reset form on success
      setFormData({ subject: '', message: '' });
      setFiles([]);
      
      toast({
        title: t('contact.success.title') || 'Сообщение отправлено',
        description: t('contact.success.description') || 'Ваше сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('contact.error.title') || 'Ошибка отправки сообщения',
        description: t('contact.error.message') || 'При отправке сообщения произошла ошибка. Пожалуйста, попробуйте еще раз позже.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Manager info card */}
      <div className="bg-muted/30 rounded-lg p-4 border">
        <h3 className="text-md font-medium mb-3">
          {t('contact_info') || 'Контактная информация'}
        </h3>
        <div className="space-y-2">
          <div className="flex items-start">
            <UserIcon className="w-4 h-4 mr-2 mt-1" />
            <div>
              <p className="font-medium">{manager.name || 'Support Team'}</p>
              {manager.position && (
                <p className="text-sm text-muted-foreground">{manager.position}</p>
              )}
            </div>
          </div>
          
          {manager.email && (
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              <a href={`mailto:${manager.email}`} className="text-sm hover:underline">
                {manager.email}
              </a>
            </div>
          )}
          
          {manager.phone && (
            <div className="flex items-center">
              <Phone className="w-4 h-4 mr-2" />
              <a href={`tel:${manager.phone}`} className="text-sm hover:underline">
                {manager.phone}
              </a>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 hidden">
        <div className="space-y-2">
          <Label htmlFor="subject">{t('contact.form.subject') || 'Тема'}</Label>
          <Input
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder={t('contact.form.subjectPlaceholder') || 'О чем ваш вопрос?'}
            required
          />
        </div>
      
      <div className="space-y-2">
        <Label htmlFor="message">{t('contact.form.message') || 'Сообщение'}</Label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder={t('contact.form.messagePlaceholder') || 'Пожалуйста, опишите ваш вопрос или проблему подробно...'}
          rows={5}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="attachments">{t('contact.form.attachments') || 'Вложения'}</Label>
        
        <div className="mt-1 flex items-center">
          <label className="block">
            <span className="sr-only">{t('contact.form.uploadFiles') || 'Загрузить файлы'}</span>
            <Input
              id="attachments"
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('attachments')?.click()}
              className="flex items-center"
            >
              <FilePlus className="mr-2 h-4 w-4" />
              {t('contact.form.addFiles') || 'Добавить файлы'}
            </Button>
          </label>
        </div>
        
        {files.length > 0 && (
          <div className="mt-2 space-y-2">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
              >
                <div className="flex items-center">
                  <PaperclipIcon className="h-4 w-4 mr-2" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('contact.form.sending') || 'Отправка...'}
          </>
        ) : t('contact.form.send') || 'Отправить сообщение'}
      </Button>
    </form>
    </div>
  );
}

export default ContactForm;