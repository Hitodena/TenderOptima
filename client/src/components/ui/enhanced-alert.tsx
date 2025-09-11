import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, XCircle, AlertTriangle } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success:
          "border-green-500/50 text-green-700 bg-green-50 dark:border-green-500 dark:text-green-400 dark:bg-green-950 [&>svg]:text-green-600",
        warning:
          "border-yellow-500/50 text-yellow-700 bg-yellow-50 dark:border-yellow-500 dark:text-yellow-400 dark:bg-yellow-950 [&>svg]:text-yellow-600",
        info:
          "border-blue-500/50 text-blue-700 bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:bg-blue-950 [&>svg]:text-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const EnhancedAlert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
EnhancedAlert.displayName = "Alert";

const EnhancedAlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
EnhancedAlertTitle.displayName = "AlertTitle";

const EnhancedAlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
EnhancedAlertDescription.displayName = "AlertDescription";

// Enhanced Alert with icons
interface EnhancedAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning" | "info";
  title?: string;
  description?: string;
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const EnhancedAlertWithIcon = React.forwardRef<HTMLDivElement, EnhancedAlertProps>(
  ({ 
    className, 
    variant = "default", 
    title, 
    description, 
    showIcon = true, 
    dismissible = false,
    onDismiss,
    children,
    ...props 
  }, ref) => {
    const getIcon = () => {
      switch (variant) {
        case "success":
          return <CheckCircle className="h-4 w-4" />;
        case "destructive":
          return <XCircle className="h-4 w-4" />;
        case "warning":
          return <AlertTriangle className="h-4 w-4" />;
        case "info":
          return <Info className="h-4 w-4" />;
        default:
          return <AlertCircle className="h-4 w-4" />;
      }
    };

    return (
      <EnhancedAlert
        ref={ref}
        variant={variant}
        className={cn("relative", className)}
        {...props}
      >
        {showIcon && getIcon()}
        {dismissible && (
          <button
            onClick={onDismiss}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
        {title && <EnhancedAlertTitle>{title}</EnhancedAlertTitle>}
        {description && <EnhancedAlertDescription>{description}</EnhancedAlertDescription>}
        {children}
      </EnhancedAlert>
    );
  }
);
EnhancedAlertWithIcon.displayName = "EnhancedAlertWithIcon";

// Error message component with specific error types
interface ErrorMessageProps {
  error?: string | Error | null;
  type?: "validation" | "network" | "auth" | "server" | "general";
  className?: string;
}

const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ error, type = "general", className }, ref) => {
    if (!error) return null;

    const errorMessage = typeof error === "string" ? error : error.message;
    
    const getErrorConfig = () => {
      switch (type) {
        case "validation":
          return {
            variant: "warning" as const,
            title: "Ошибка валидации",
            icon: <AlertCircle className="h-4 w-4" />,
          };
        case "network":
          return {
            variant: "destructive" as const,
            title: "Ошибка сети",
            icon: <XCircle className="h-4 w-4" />,
          };
        case "auth":
          return {
            variant: "destructive" as const,
            title: "Ошибка аутентификации",
            icon: <XCircle className="h-4 w-4" />,
          };
        case "server":
          return {
            variant: "destructive" as const,
            title: "Ошибка сервера",
            icon: <XCircle className="h-4 w-4" />,
          };
        default:
          return {
            variant: "destructive" as const,
            title: "Произошла ошибка",
            icon: <AlertCircle className="h-4 w-4" />,
          };
      }
    };

    const config = getErrorConfig();

    return (
      <EnhancedAlertWithIcon
        ref={ref}
        variant={config.variant}
        title={config.title}
        description={errorMessage}
        className={cn("mt-2", className)}
      />
    );
  }
);
ErrorMessage.displayName = "ErrorMessage";

// Success message component
interface SuccessMessageProps {
  message: string;
  title?: string;
  className?: string;
}

const SuccessMessage = React.forwardRef<HTMLDivElement, SuccessMessageProps>(
  ({ message, title = "Успешно", className }, ref) => (
    <EnhancedAlertWithIcon
      ref={ref}
      variant="success"
      title={title}
      description={message}
      className={cn("mt-2", className)}
    />
  )
);
SuccessMessage.displayName = "SuccessMessage";

// Info message component
interface InfoMessageProps {
  message: string;
  title?: string;
  className?: string;
}

const InfoMessage = React.forwardRef<HTMLDivElement, InfoMessageProps>(
  ({ message, title = "Информация", className }, ref) => (
    <EnhancedAlertWithIcon
      ref={ref}
      variant="info"
      title={title}
      description={message}
      className={cn("mt-2", className)}
    />
  )
);
InfoMessage.displayName = "InfoMessage";

// Warning message component
interface WarningMessageProps {
  message: string;
  title?: string;
  className?: string;
}

const WarningMessage = React.forwardRef<HTMLDivElement, WarningMessageProps>(
  ({ message, title = "Внимание", className }, ref) => (
    <EnhancedAlertWithIcon
      ref={ref}
      variant="warning"
      title={title}
      description={message}
      className={cn("mt-2", className)}
    />
  )
);
WarningMessage.displayName = "WarningMessage";

export {
  EnhancedAlert,
  EnhancedAlertTitle,
  EnhancedAlertDescription,
  EnhancedAlertWithIcon,
  ErrorMessage,
  SuccessMessage,
  InfoMessage,
  WarningMessage,
};


