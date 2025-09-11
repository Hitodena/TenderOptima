import React from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle } from "lucide-react";

// Password strength indicator component
export const PasswordStrengthIndicator = ({ password }: { password: string }) => {
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
  const strengthColors = [
    'bg-red-500', 
    'bg-orange-500', 
    'bg-yellow-500', 
    'bg-blue-500', 
    'bg-green-500'
  ];

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Progress value={(strength / 5) * 100} className="flex-1" />
        <span className="text-sm text-muted-foreground min-w-fit">
          {strengthLabels[strength - 1] || 'Очень слабый'}
        </span>
      </div>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded transition-colors ${
              level <= strength ? strengthColors[strength - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Password requirements component
export const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = [
    { text: 'Минимум 8 символов', met: password.length >= 8 },
    { text: 'Заглавная буква', met: /[A-Z]/.test(password) },
    { text: 'Строчная буква', met: /[a-z]/.test(password) },
    { text: 'Цифра', met: /\d/.test(password) },
    { text: 'Специальный символ', met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="space-y-1">
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center space-x-2 text-sm">
          {req.met ? (
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
          <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
            {req.text}
          </span>
        </div>
      ))}
    </div>
  );
};

// Password strength meter with detailed feedback
export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const getStrengthDetails = (password: string) => {
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;
    const percentage = (score / 5) * 100;

    let strength = 'Очень слабый';
    let color = 'bg-red-500';
    let textColor = 'text-red-600';

    if (percentage >= 80) {
      strength = 'Отличный';
      color = 'bg-green-500';
      textColor = 'text-green-600';
    } else if (percentage >= 60) {
      strength = 'Хороший';
      color = 'bg-blue-500';
      textColor = 'text-blue-600';
    } else if (percentage >= 40) {
      strength = 'Средний';
      color = 'bg-yellow-500';
      textColor = 'text-yellow-600';
    } else if (percentage >= 20) {
      strength = 'Слабый';
      color = 'bg-orange-500';
      textColor = 'text-orange-600';
    }

    return { checks, score, percentage, strength, color, textColor };
  };

  const { checks, score, percentage, strength, color, textColor } = getStrengthDetails(password);

  if (!password) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Сила пароля</span>
          <span className={`text-sm font-medium ${textColor}`}>{strength}</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
      
      <div className="space-y-1">
        {Object.entries(checks).map(([key, met]) => {
          const labels = {
            length: 'Минимум 8 символов',
            lowercase: 'Строчная буква',
            uppercase: 'Заглавная буква',
            number: 'Цифра',
            special: 'Специальный символ',
          };
          
          return (
            <div key={key} className="flex items-center space-x-2 text-sm">
              {met ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
              <span className={met ? 'text-green-600' : 'text-gray-500'}>
                {labels[key as keyof typeof labels]}
              </span>
            </div>
          );
        })}
      </div>
      
      {score < 5 && (
        <div className="text-xs text-muted-foreground">
          Для повышения безопасности добавьте недостающие требования
        </div>
      )}
    </div>
  );
};

// Password validation hook
export const usePasswordValidation = (password: string) => {
  const validation = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const isValid = Object.values(validation).every(Boolean);
  const score = Object.values(validation).filter(Boolean).length;

  return {
    validation,
    isValid,
    score,
    strength: score >= 4 ? 'strong' : score >= 3 ? 'medium' : 'weak',
  };
};


