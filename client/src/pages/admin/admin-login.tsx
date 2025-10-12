import React, { useState, useEffect } from "react";
import { useLocation, Route, Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { loginMutation, user } = useAuth();

  // If user is already logged in, try to verify admin status
  // ЗАКОММЕНТИРОВАНО: предотвращаем автоматическое перенаправление на админ-панель
  /*
  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);
  */

  // Function to check admin status
  const checkAdminStatus = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Check if user has admin rights using the correct endpoint
      const adminResponse = await apiRequest<{ isAdmin: boolean, user: any }>("/api/admin/check-admin", "POST", {
        username: username || user.username
      });
      
      if (adminResponse.isAdmin) {
        toast({
          title: "Проверка доступа",
          description: "Доступ к панели администратора подтвержден"
        });
        
        // Store admin status in localStorage
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminUsername', user.username);
        
        // Redirect to admin panel
        navigate("/admpanel");
      }
    } catch (err) {
      console.error("Admin rights check failed:", err);
      // Don't show an error if the user is already on the admin login page
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Try regular login first
      await loginMutation.mutateAsync({ username, password });
      
      // After successful login, check if user has admin role
      // The loginMutation will set the user context with role information
      // We need to wait a bit for the context to update
      setTimeout(async () => {
        try {
          // Check current user's role from the auth context
          const currentUser = await apiRequest<{ role: string }>("/api/auth/me", "GET");
          
          if (currentUser.role === 'admin') {
            // Store admin credentials in localStorage
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('adminUsername', username);
            
            toast({
              title: "Успешный вход",
              description: "Вы вошли как администратор"
            });
            
            navigate("/admpanel");
          } else {
            setError("У вас нет прав доступа к панели администратора");
            toast({
              title: "Ошибка доступа",
              description: "У вас нет прав доступа к панели администратора",
              variant: "destructive"
            });
          }
        } catch (roleError) {
          console.error("Error checking admin role:", roleError);
          setError("Ошибка проверки прав доступа");
          toast({
            title: "Ошибка доступа",
            description: "Ошибка проверки прав доступа",
            variant: "destructive"
          });
        }
      }, 100);
      
    } catch (loginError) {
      console.error("Login error:", loginError);
      setError("Неверные учетные данные");
      toast({
        title: "Ошибка входа",
        description: "Неверные учетные данные",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-2">
            <ShieldIcon className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Панель администратора</CardTitle>
          <CardDescription className="text-center">
            Введите учетные данные администратора для входа
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminLogin}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Вход..." : "Войти"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            Вернуться на главную страницу
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}