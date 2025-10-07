import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Loader, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Mail,
  Lock,
  User,
  Shield,
  Zap,
  Star,
  Heart
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Enhanced login form schema with better validation
const loginSchema = z.object({
  username: z.string()
    .min(1, { message: "Email обязателен" })
    .email({ message: "Введите корректный email адрес" }),
  password: z.string()
    .min(1, { message: "Пароль обязателен" })
    .min(6, { message: "Пароль должен содержать минимум 6 символов" }),
});

// Enhanced registration form schema
const registerSchema = z.object({
  email: z.string()
    .min(1, { message: "Email обязателен" })
    .email({ message: "Введите корректный email адрес" }),
  password: z.string()
    .min(1, { message: "Пароль обязателен" })
    .min(8, { message: "Пароль должен содержать минимум 8 символов" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { 
      message: "Пароль должен содержать заглавные и строчные буквы, а также цифры" 
    }),
  confirmPassword: z.string()
    .min(1, { message: "Подтверждение пароля обязательно" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли должны совпадать",
  path: ["confirmPassword"],
});

// Enhanced forgot password schema
const forgotPasswordSchema = z.object({
  username: z.string()
    .min(1, { message: "Email обязателен" })
    .email({ message: "Введите корректный email адрес" }),
});

// Enhanced reset password schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Токен сброса пароля обязателен" }),
  password: z.string()
    .min(8, { message: "Пароль должен содержать минимум 8 символов" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { 
      message: "Пароль должен содержать заглавные и строчные буквы, а также цифры" 
    }),
  confirmPassword: z.string()
    .min(1, { message: "Подтверждение пароля обязательно" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли должны совпадать",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Password strength indicator component
const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const getStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength(password);
  const strengthLabels = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Progress value={(strength / 5) * 100} className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {strengthLabels[strength - 1] || 'Очень слабый'}
        </span>
      </div>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded ${
              level <= strength ? strengthColors[strength - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Password requirements component
const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = [
    { text: 'Минимум 8 символов', met: password.length >= 8 },
    { text: 'Заглавная буква', met: /[A-Z]/.test(password) },
    { text: 'Строчная буква', met: /[a-z]/.test(password) },
    { text: 'Цифра', met: /\d/.test(password) },
  ];

  return (
    <div className="space-y-1">
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center space-x-2 text-sm">
          {req.met ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400" />
          )}
          <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
            {req.text}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function EnhancedAuthPage() {
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPasswordField, setShowResetPasswordField] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  
  // Login form
  const loginForm = useForm<LoginFormData>({
    // resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormData>({
    // resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });
  
  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    // resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: "",
    },
  });
  
  // Reset password form
  const resetPasswordForm = useForm<ResetPasswordFormData>({
    // resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Check for reset token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setShowResetPassword(true);
      resetPasswordForm.setValue('token', token);
    }
  }, [resetPasswordForm]);

  // Block timer effect
  useEffect(() => {
    if (isBlocked && blockTimeRemaining > 0) {
      const timer = setTimeout(() => {
        setBlockTimeRemaining(blockTimeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (blockTimeRemaining === 0 && isBlocked) {
      setIsBlocked(false);
      setLoginAttempts(0);
    }
  }, [isBlocked, blockTimeRemaining]);
  
  // Redirect if already logged in
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }
  
  // Handle login submission with enhanced error handling
  const onLoginSubmit = async (data: LoginFormData) => {
    if (isBlocked) {
      toast({
        title: "Доступ заблокирован",
        description: `Попробуйте снова через ${blockTimeRemaining} секунд`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await loginMutation.mutateAsync(data);
      
      // Reset attempts on successful login
      setLoginAttempts(0);
      
      toast({
        title: "Добро пожаловать!",
        description: "Вы успешно вошли в систему",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Ошибка в процессе входа:', error);
      
      // Increment failed attempts
      setLoginAttempts(prev => prev + 1);
      
      // Block after 5 failed attempts
      if (loginAttempts >= 4) {
        setIsBlocked(true);
        setBlockTimeRemaining(300); // 5 minutes
        toast({
          title: "Слишком много неудачных попыток",
          description: "Доступ заблокирован на 5 минут",
          variant: "destructive",
        });
        return;
      }
      
      // Show specific error messages
      let errorMessage = "Произошла ошибка при входе";
      if (error?.response?.status === 401) {
        errorMessage = "Неверный email или пароль";
      } else if (error?.response?.status === 429) {
        errorMessage = "Слишком много попыток входа. Попробуйте позже";
      } else if (error?.response?.status === 403) {
        errorMessage = "Ваш IP адрес заблокирован";
      }
      
      toast({
        title: "Ошибка входа",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle registration submission with enhanced feedback
  const onRegisterSubmit = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true);
      const { confirmPassword, ...credentials } = data;
      await registerMutation.mutateAsync(credentials);
      
      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать в TenderOptima!",
        variant: "default",
      });
      
      // Switch to login tab after successful registration
      setActiveTab("login");
      loginForm.setValue("username", data.email);
    } catch (error: any) {
      console.error('Ошибка регистрации:', error);
      
      let errorMessage = "Произошла ошибка при регистрации";
      if (error?.response?.status === 409) {
        errorMessage = "Пользователь с таким email уже существует";
      } else if (error?.response?.status === 400) {
        errorMessage = "Проверьте правильность введенных данных";
      }
      
      toast({
        title: "Ошибка регистрации",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle forgot password submission
  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsSubmitting(true);
      const response = await apiRequest("/api/auth/forgot-password", "POST", data);
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: "Инструкции отправлены",
          description: "Проверьте вашу почту для получения ссылки сброса пароля",
          variant: "default",
        });
        setShowForgotPassword(false);
      } else {
        throw new Error(responseData.message || "Ошибка отправки запроса");
      }
    } catch (error: any) {
      console.error('Ошибка восстановления пароля:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос на восстановление пароля",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reset password submission
  const onResetPasswordSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsSubmitting(true);
      const response = await apiRequest("/api/auth/reset-password", "POST", data);
      const responseData = await response.json();
      
      if (response.ok) {
        toast({
          title: "Пароль изменен",
          description: "Ваш пароль успешно изменен. Теперь вы можете войти в систему",
          variant: "default",
        });
        setShowResetPassword(false);
        setActiveTab("login");
      } else {
        throw new Error(responseData.message || "Ошибка сброса пароля");
      }
    } catch (error: any) {
      console.error('Ошибка сброса пароля:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сбросить пароль",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full">
        {/* Enhanced Auth forms */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              TenderOptima
            </h1>
            <p className="text-lg text-muted-foreground mb-2">
              Платформа поиска поставщиков и анализа коммерческих предложений
            </p>
            <div className="flex items-center justify-center lg:justify-start space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Безопасно</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4 text-blue-500" />
                <span>Быстро</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Надежно</span>
              </div>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="login" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Вход</span>
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center space-x-2">
                <Heart className="h-4 w-4" />
                <span>Регистрация</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              {showForgotPassword ? (
                <Card className="border-2 border-blue-200 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
                    <CardDescription className="text-base">
                      Введите ваш email для получения инструкций по сбросу пароля
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="text-sm font-medium">
                          Email адрес
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="mail@example.com"
                            className="pl-10"
                            {...forgotPasswordForm.register("username")}
                          />
                        </div>
                        {forgotPasswordForm.formState.errors.username && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {forgotPasswordForm.formState.errors.username.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col space-y-3">
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Отправка запроса...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Отправить инструкции
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowForgotPassword(false)}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Вернуться к форме входа
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              ) : showResetPassword ? (
                <Card className="border-2 border-green-200 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
                      <Lock className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl">Сброс пароля</CardTitle>
                    <CardDescription className="text-base">
                      Создайте новый пароль для вашей учетной записи
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)}>
                    <CardContent className="space-y-4">
                      {!resetToken && (
                        <div className="space-y-2">
                          <Label htmlFor="reset-token" className="text-sm font-medium">
                            Токен сброса пароля
                          </Label>
                          <Input
                            id="reset-token"
                            type="text"
                            placeholder="Введите токен из email"
                            {...resetPasswordForm.register("token")}
                          />
                          {resetPasswordForm.formState.errors.token && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {resetPasswordForm.formState.errors.token.message}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="reset-password" className="text-sm font-medium">
                          Новый пароль
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reset-password"
                            type={showResetPasswordField ? "text" : "password"}
                            placeholder="Введите новый пароль"
                            className="pl-10 pr-10"
                            {...resetPasswordForm.register("password")}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowResetPasswordField(!showResetPasswordField)}
                          >
                            {showResetPasswordField ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {resetPasswordForm.formState.errors.password && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {resetPasswordForm.formState.errors.password.message}
                            </AlertDescription>
                          </Alert>
                        )}
                        <PasswordStrengthIndicator 
                          password={resetPasswordForm.watch("password") || ""} 
                        />
                        <PasswordRequirements 
                          password={resetPasswordForm.watch("password") || ""} 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reset-confirm-password" className="text-sm font-medium">
                          Подтвердите пароль
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reset-confirm-password"
                            type={showResetConfirmPassword ? "text" : "password"}
                            placeholder="Подтвердите новый пароль"
                            className="pl-10 pr-10"
                            {...resetPasswordForm.register("confirmPassword")}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                          >
                            {showResetConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {resetPasswordForm.formState.errors.confirmPassword && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {resetPasswordForm.formState.errors.confirmPassword.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col space-y-3">
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Сброс пароля...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Сбросить пароль
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowResetPassword(false)}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Вернуться к форме входа
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              ) : (
                <Card className="border-2 border-blue-200 shadow-lg">
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl">Вход в систему</CardTitle>
                    <CardDescription className="text-base">
                      Войдите в свой аккаунт для доступа к платформе
                    </CardDescription>
                  </CardHeader>
                  
                  {isBlocked && (
                    <CardContent>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Слишком много неудачных попыток входа. 
                          Попробуйте снова через {formatTime(blockTimeRemaining)}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  )}
                  
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-medium">
                          Email адрес
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="mail@example.com"
                            className="pl-10"
                            disabled={isBlocked}
                            {...loginForm.register("username")}
                          />
                        </div>
                        {loginForm.formState.errors.username && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {loginForm.formState.errors.username.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-medium">
                          Пароль
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Введите пароль"
                            className="pl-10 pr-10"
                            disabled={isBlocked}
                            {...loginForm.register("password")}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {loginForm.formState.errors.password.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      {loginAttempts > 0 && !isBlocked && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Неудачных попыток: {loginAttempts}/5
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                    
                    <CardFooter className="flex flex-col space-y-3">
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        disabled={isSubmitting || isBlocked}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Вход в систему...
                          </>
                        ) : (
                          <>
                            <User className="mr-2 h-4 w-4" />
                            Войти
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-sm"
                        onClick={() => setShowForgotPassword(true)}
                        disabled={isBlocked}
                      >
                        Забыли пароль?
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="register">
              <Card className="border-2 border-purple-200 shadow-lg">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-purple-100 rounded-full w-fit">
                    <Heart className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle className="text-2xl">Регистрация</CardTitle>
                  <CardDescription className="text-base">
                    Создайте аккаунт для доступа к платформе
                  </CardDescription>
                </CardHeader>
                
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-sm font-medium">
                        Email адрес
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="mail@example.com"
                          className="pl-10"
                          {...registerForm.register("email")}
                        />
                      </div>
                      {registerForm.formState.errors.email && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {registerForm.formState.errors.email.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-sm font-medium">
                        Пароль
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Создайте пароль"
                          className="pl-10 pr-10"
                          {...registerForm.register("password")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {registerForm.formState.errors.password.message}
                          </AlertDescription>
                        </Alert>
                      )}
                      <PasswordStrengthIndicator 
                        password={registerForm.watch("password") || ""} 
                      />
                      <PasswordRequirements 
                        password={registerForm.watch("password") || ""} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password" className="text-sm font-medium">
                        Подтвердите пароль
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Подтвердите пароль"
                          className="pl-10 pr-10"
                          {...registerForm.register("confirmPassword")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.confirmPassword && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {registerForm.formState.errors.confirmPassword.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex flex-col space-y-3">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Создание аккаунта...
                        </>
                      ) : (
                        <>
                          <Heart className="mr-2 h-4 w-4" />
                          Создать аккаунт
                        </>
                      )}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center">
                      Регистрируясь, вы соглашаетесь с нашими условиями использования
                    </p>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Enhanced Features showcase */}
        <div className="hidden lg:flex flex-col justify-center space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Почему выбирают TenderOptima?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Современная платформа для эффективного поиска поставщиков
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-start space-x-4 p-6 bg-white rounded-lg shadow-md border border-gray-100">
              <div className="p-3 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Безопасность</h3>
                <p className="text-muted-foreground">
                  Защита данных с помощью современных технологий шифрования и мониторинга
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-6 bg-white rounded-lg shadow-md border border-gray-100">
              <div className="p-3 bg-green-100 rounded-full">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Скорость</h3>
                <p className="text-muted-foreground">
                  Быстрый поиск и анализ поставщиков с помощью ИИ технологий
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-6 bg-white rounded-lg shadow-md border border-gray-100">
              <div className="p-3 bg-purple-100 rounded-full">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Качество</h3>
                <p className="text-muted-foreground">
                  Точный анализ коммерческих предложений и рекомендации
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


