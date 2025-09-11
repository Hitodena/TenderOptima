import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
// // import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Shield,
  Clock,
  RefreshCw
} from "lucide-react";
import { useEnhancedAuth } from "@/hooks/use-enhanced-auth";
import { PasswordStrengthIndicator, PasswordRequirements } from "./password-strength";

// Schema for forgot password
const forgotPasswordSchema = z.object({
  username: z.string()
    .min(1, { message: "Email обязателен" })
    .email({ message: "Введите корректный email адрес" }),
});

// Schema for reset password
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

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface PasswordRecoveryProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export function PasswordRecovery({ onBack, onSuccess }: PasswordRecoveryProps) {
  const { forgotPasswordMutation, resetPasswordMutation } = useEnhancedAuth();
  const [step, setStep] = useState<'forgot' | 'reset' | 'success'>('forgot');
  const [resetToken, setResetToken] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Forgot password form
  const forgotForm = useForm<ForgotPasswordFormData>({
    // resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: "",
    },
  });

  // Reset password form
  const resetForm = useForm<ResetPasswordFormData>({
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
      setStep('reset');
      resetForm.setValue('token', token);
    }
  }, [resetForm]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle forgot password submission
  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPasswordMutation.mutateAsync(data);
      setCountdown(60); // 1 minute cooldown
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  // Handle reset password submission
  const onResetPasswordSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPasswordMutation.mutateAsync(data);
      setStep('success');
      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (step === 'success') {
    return (
      <Card className="border-2 border-green-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Пароль изменен!</CardTitle>
          <CardDescription className="text-base">
            Ваш пароль успешно изменен. Теперь вы можете войти в систему с новым паролем.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            onClick={onBack}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Вернуться к входу
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === 'reset') {
    return (
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Сброс пароля</CardTitle>
          <CardDescription className="text-base">
            Создайте новый пароль для вашей учетной записи
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)}>
          <CardContent className="space-y-4">
            {!resetToken && (
              <div className="space-y-2">
                <Label htmlFor="reset-token" className="text-sm font-medium">
                  Токен сброса пароля
                </Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-token"
                    type="text"
                    placeholder="Введите токен из email"
                    className="pl-10"
                    {...resetForm.register("token")}
                  />
                </div>
                {resetForm.formState.errors.token && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {resetForm.formState.errors.token.message}
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
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите новый пароль"
                  className="pl-10 pr-10"
                  {...resetForm.register("password")}
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
              {resetForm.formState.errors.password && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {resetForm.formState.errors.password.message}
                  </AlertDescription>
                </Alert>
              )}
              <PasswordStrengthIndicator 
                password={resetForm.watch("password") || ""} 
              />
              <PasswordRequirements 
                password={resetForm.watch("password") || ""} 
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
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Подтвердите новый пароль"
                  className="pl-10 pr-10"
                  {...resetForm.register("confirmPassword")}
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
              {resetForm.formState.errors.confirmPassword && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {resetForm.formState.errors.confirmPassword.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
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
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Вернуться к форме входа
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-orange-200 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
          <Mail className="h-6 w-6 text-orange-600" />
        </div>
        <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
        <CardDescription className="text-base">
          Введите ваш email для получения инструкций по сбросу пароля
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={forgotForm.handleSubmit(onForgotPasswordSubmit)}>
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
                {...forgotForm.register("username")}
              />
            </div>
            {forgotForm.formState.errors.username && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {forgotForm.formState.errors.username.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {countdown > 0 && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Следующий запрос можно отправить через {formatTime(countdown)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-3">
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            disabled={forgotPasswordMutation.isPending || countdown > 0}
          >
            {forgotPasswordMutation.isPending ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Отправка запроса...
              </>
            ) : countdown > 0 ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Подождите {formatTime(countdown)}
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
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Вернуться к форме входа
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}


