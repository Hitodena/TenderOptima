// Simplified toast implementation to make imports work

// Types for toast interface
interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

// Create a global DOM-based toast function that works without React
const showToast = (props: ToastProps) => {
  console.log('Toast called with:', props);
  
  // Create a notification element
  const notification = document.createElement('div');
  notification.className = 'fixed z-50 top-4 right-4 max-w-md bg-white rounded-lg shadow-lg border p-4 transition-all duration-300';
  notification.style.opacity = '0';
  notification.style.transform = 'translateY(-20px)';
  
  if (props.variant === 'destructive') {
    notification.className += ' border-red-500 bg-red-50';
  } else if (props.variant === 'success') {
    notification.className += ' border-green-500 bg-green-50';
  } else {
    notification.className += ' border-gray-200';
  }
  
  // Add title
  const title = document.createElement('h3');
  title.className = 'text-sm font-semibold';
  title.textContent = props.title;
  notification.appendChild(title);
  
  // Add description if exists
  if (props.description) {
    const desc = document.createElement('p');
    desc.className = 'text-sm text-gray-500 mt-1';
    desc.textContent = props.description;
    notification.appendChild(desc);
  }
  
  // Add to DOM
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
  
  return 'toast-id';
};

// Create a useToast hook that returns the required interface
export const useToast = () => {
  return {
    toast: showToast,
    dismissToast: (id: string) => {
      console.log('Dismiss toast:', id);
    },
    toasts: []
  };
};

// Direct import version - this is the key fix
interface ToastFunction {
  (props: ToastProps): string;
  success: (message: string) => string;
  error: (message: string) => string;
  message: (title: string, description: string) => string;
}

// Create a function with the additional properties
const toast = showToast as ToastFunction;

// Add helper methods to toast
toast.success = (message: string) => {
  return showToast({ title: 'Success', description: message, variant: 'success' });
};

toast.error = (message: string) => {
  return showToast({ title: 'Error', description: message, variant: 'destructive' });
};

toast.message = (title: string, description: string) => {
  return showToast({ title, description });
};

export { toast };

export default useToast;