import { useState } from "react";
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
import { Loader, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Login form schema
const loginSchema = z.object({
  username: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
  confirmPassword: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли должны совпадать",
  path: ["confirmPassword"],
});

// Forgot password schema
const forgotPasswordSchema = z.object({
  username: z.string().email({ message: "Введите корректный email" }),
});

// Reset password schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Токен сброса пароля обязателен" }),
  password: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
  confirmPassword: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли должны совпадать",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [isRegisterPending, setIsRegisterPending] = useState(false);
  
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
  
  // Redirect if already logged in - moved after all hook calls
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }
  
  // Handle login submission with error tracking
  const onLoginSubmit = async (data: LoginFormData) => {
    console.log('Начинаем процесс входа для пользователя:', data.username);
    try {
      setIsLoginPending(true);
      await loginMutation.mutateAsync(data);
      console.log('Вход успешен, пользователь будет перенаправлен');
      // После успешного входа пользователь будет автоматически перенаправлен
      // благодаря проверке if (user) { return <Redirect to="/" /> }
    } catch (error) {
      console.error('Ошибка в процессе входа:', error);
      // Не нужно показывать toast здесь, т.к. он уже показывается в обработчике onError в loginMutation
    } finally {
      setIsLoginPending(false);
    }
  };
  
  // Handle registration submission
  const onRegisterSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...credentials } = data;
    setIsRegisterPending(true);
    registerMutation.mutate(credentials, {
      onSettled: () => {
        setIsRegisterPending(false);
      }
    });
  };
  
  // Handle forgot password submission
  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsSubmitting(true);
      const response = await apiRequest("/api/auth/forgot-password", "POST", data);
      const responseData = await response.json();
      
      toast({
        title: "Запрос отправлен",
        description: responseData.message || "Инструкции по сбросу пароля отправлены на указанный email",
      });
      
      // Reset the form
      forgotPasswordForm.reset();
      
      // Return to login view
      setShowForgotPassword(false);
    } catch (error) {
      console.error("Forgot password error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при отправке запроса на сброс пароля",
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
      const { confirmPassword, ...resetData } = data;
      
      // Use the token from state if available, otherwise use the one from the form
      if (resetToken) {
        resetData.token = resetToken;
      }
      
      const response = await apiRequest("/api/auth/reset-password", "POST", resetData);
      const responseData = await response.json();
      
      toast({
        title: "Пароль изменен",
        description: responseData.message || "Ваш пароль был успешно изменен",
      });
      
      // Reset the form
      resetPasswordForm.reset();
      
      // Return to login view
      setShowResetPassword(false);
      setResetToken(null);
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при сбросе пароля",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full">
        {/* Auth forms */}
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold mb-2">TenderOptima</h1>
          <p className="text-muted-foreground mb-8">
            Платформа поиска поставщиков и анализа коммерческих предложений
          </p>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              {showForgotPassword ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Восстановление пароля</CardTitle>
                    <CardDescription>
                      Введите ваш email для получения инструкций по сбросу пароля
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="mail@example.com"
                          {...forgotPasswordForm.register("username")}
                        />
                        {forgotPasswordForm.formState.errors.username && (
                          <p className="text-sm text-destructive">
                            {forgotPasswordForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col space-y-2">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Отправка запроса...
                          </>
                        ) : (
                          "Отправить инструкции"
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
                <Card>
                  <CardHeader>
                    <CardTitle>Сброс пароля</CardTitle>
                    <CardDescription>
                      Создайте новый пароль для вашей учетной записи
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)}>
                    <CardContent className="space-y-4">
                      {!resetToken && (
                        <div className="space-y-2">
                          <Label htmlFor="reset-token">Токен сброса пароля</Label>
                          <Input
                            id="reset-token"
                            type="text"
                            placeholder="Введите токен из email"
                            {...resetPasswordForm.register("token")}
                          />
                          {resetPasswordForm.formState.errors.token && (
                            <p className="text-sm text-destructive">
                              {resetPasswordForm.formState.errors.token.message}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="reset-password">Новый пароль</Label>
                        <Input
                          id="reset-password"
                          type="password"
                          {...resetPasswordForm.register("password")}
                        />
                        {resetPasswordForm.formState.errors.password && (
                          <p className="text-sm text-destructive">
                            {resetPasswordForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reset-confirm-password">Подтверждение пароля</Label>
                        <Input
                          id="reset-confirm-password"
                          type="password"
                          {...resetPasswordForm.register("confirmPassword")}
                        />
                        {resetPasswordForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-destructive">
                            {resetPasswordForm.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="flex flex-col space-y-2">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Сброс пароля...
                          </>
                        ) : (
                          "Сбросить пароль"
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setShowResetPassword(false);
                          setResetToken(null);
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Вернуться к форме входа
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Вход в систему</CardTitle>
                    <CardDescription>
                      Войдите в свою учетную запись для доступа к платформе
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="mail@example.com"
                          {...loginForm.register("username")}
                        />
                        {loginForm.formState.errors.username && (
                          <p className="text-sm text-destructive">
                            {loginForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Пароль</Label>
                        <Input
                          id="login-password"
                          type="password"
                          {...loginForm.register("password")}
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-destructive">
                            {loginForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 h-auto font-normal text-sm"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Забыли пароль?
                        </Button>
                      </div>
                    </CardContent>
                    
                    <CardFooter>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoginPending}
                      >
                        {isLoginPending ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Вход...
                          </>
                        ) : (
                          "Войти"
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Создание учетной записи</CardTitle>
                  <CardDescription>
                    Зарегистрируйтесь для доступа к платформе поиска поставщиков
                  </CardDescription>
                </CardHeader>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="mail@example.com"
                        {...registerForm.register("username")}
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Пароль</Label>
                      <Input
                        id="register-password"
                        type="password"
                        {...registerForm.register("password")}
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password">Подтверждение пароля</Label>
                      <Input
                        id="register-confirm-password"
                        type="password"
                        {...registerForm.register("confirmPassword")}
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isRegisterPending}
                    >
                      {isRegisterPending ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Регистрация...
                        </>
                      ) : (
                        "Зарегистрироваться"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Hero section */}
        <div className="hidden lg:flex flex-col justify-center p-6 bg-muted rounded-xl">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">
              Автоматизированный анализ коммерческих предложений
            </h2>
            
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="mr-4 rounded-full bg-primary/10 p-1">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Быстрый поиск поставщиков</h3>
                  <p className="text-muted-foreground text-sm">
                    Находите потенциальных поставщиков по вашему запросу
                  </p>
                </div>
              </li>
              
              <li className="flex items-start">
                <div className="mr-4 rounded-full bg-primary/10 p-1">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Автоматизированный анализ предложений</h3>
                  <p className="text-muted-foreground text-sm">
                    Извлекайте ключевые параметры из документов и сравнивайте предложения
                  </p>
                </div>
              </li>
              
              <li className="flex items-start">
                <div className="mr-4 rounded-full bg-primary/10 p-1">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">AI-аналитика данных</h3>
                  <p className="text-muted-foreground text-sm">
                    Используйте искусственный интеллект для выбора оптимального предложения
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}