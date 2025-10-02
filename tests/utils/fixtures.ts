/**
 * Тестовые данные (фикстуры) для тестирования
 */

export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    name: 'Test Admin',
    role: 'admin'
  },
  user: {
    email: 'user@test.com',
    password: 'UserPassword123!',
    name: 'Test User',
    role: 'user'
  },
  supplier: {
    email: 'supplier@test.com',
    password: 'SupplierPassword123!',
    name: 'Test Supplier',
    role: 'supplier'
  }
};

export const testSearchRequests = {
  electronics: {
    title: 'Electronics Manufacturing Request',
    description: 'Looking for electronics manufacturers with ISO certification',
    requirements: ['ISO 9001', 'Quality control', 'Fast delivery'],
    budget: 50000,
    deadline: '2024-12-31',
    category: 'electronics'
  },
  automotive: {
    title: 'Automotive Parts Supplier',
    description: 'Need automotive parts suppliers for new production line',
    requirements: ['TS 16949', 'Just-in-time delivery', 'Quality assurance'],
    budget: 100000,
    deadline: '2024-11-30',
    category: 'automotive'
  },
  textiles: {
    title: 'Textile Manufacturing',
    description: 'Looking for textile manufacturers for clothing production',
    requirements: ['OEKO-TEX certification', 'Sustainable materials', 'Bulk production'],
    budget: 75000,
    deadline: '2024-10-15',
    category: 'textiles'
  }
};

export const testSuppliers = {
  electronics: [
    {
      name: 'ElectroTech Solutions',
      email: 'contact@electrotech.com',
      phone: '+1-555-0123',
      website: 'https://electrotech.com',
      description: 'Leading electronics manufacturer with 20+ years experience',
      categories: ['electronics', 'manufacturing'],
      rating: 4.8,
      location: 'California, USA',
      certifications: ['ISO 9001', 'ISO 14001', 'UL']
    },
    {
      name: 'Digital Components Ltd',
      email: 'sales@digitalcomponents.com',
      phone: '+1-555-0456',
      website: 'https://digitalcomponents.com',
      description: 'Specialized in digital components and circuit boards',
      categories: ['electronics', 'components'],
      rating: 4.5,
      location: 'Texas, USA',
      certifications: ['ISO 9001', 'IPC']
    }
  ],
  automotive: [
    {
      name: 'AutoParts Manufacturing',
      email: 'info@autoparts.com',
      phone: '+1-555-0789',
      website: 'https://autoparts.com',
      description: 'Automotive parts manufacturer with TS 16949 certification',
      categories: ['automotive', 'manufacturing'],
      rating: 4.7,
      location: 'Michigan, USA',
      certifications: ['TS 16949', 'ISO 9001', 'IATF']
    }
  ],
  textiles: [
    {
      name: 'Textile Solutions Inc',
      email: 'contact@textilesolutions.com',
      phone: '+1-555-0321',
      website: 'https://textilesolutions.com',
      description: 'Sustainable textile manufacturer with OEKO-TEX certification',
      categories: ['textiles', 'sustainable'],
      rating: 4.6,
      location: 'North Carolina, USA',
      certifications: ['OEKO-TEX', 'GOTS', 'ISO 9001']
    }
  ]
};

export const testContacts = {
  groups: [
    {
      name: 'Electronics Suppliers',
      description: 'Group of electronics suppliers',
      contacts: [
        {
          name: 'John Smith',
          email: 'john@electrotech.com',
          phone: '+1-555-0123',
          company: 'ElectroTech Solutions',
          position: 'Sales Manager'
        },
        {
          name: 'Sarah Johnson',
          email: 'sarah@digitalcomponents.com',
          phone: '+1-555-0456',
          company: 'Digital Components Ltd',
          position: 'Business Development'
        }
      ]
    },
    {
      name: 'Automotive Suppliers',
      description: 'Group of automotive suppliers',
      contacts: [
        {
          name: 'Mike Wilson',
          email: 'mike@autoparts.com',
          phone: '+1-555-0789',
          company: 'AutoParts Manufacturing',
          position: 'Sales Director'
        }
      ]
    }
  ]
};

export const testEmailTemplates = {
  request: {
    subject: 'New Request: {{title}}',
    body: `
Dear {{supplier_name}},

We are looking for suppliers for the following request:

Title: {{title}}
Description: {{description}}
Budget: ${{budget}}
Deadline: {{deadline}}

Please respond if you are interested in this opportunity.

Best regards,
{{user_name}}
    `.trim()
  },
  followUp: {
    subject: 'Follow-up: {{title}}',
    body: `
Dear {{supplier_name}},

This is a follow-up regarding our previous request: {{title}}

Please let us know if you need any additional information.

Best regards,
{{user_name}}
    `.trim()
  }
};

export const testDocuments = {
  requirements: {
    filename: 'requirements.pdf',
    content: 'This is a test requirements document with specifications and technical details.',
    type: 'application/pdf',
    size: 1024
  },
  specifications: {
    filename: 'specifications.docx',
    content: 'This is a test specifications document with detailed technical requirements.',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 2048
  },
  images: {
    filename: 'diagram.png',
    content: 'This is a test image file with technical diagrams.',
    type: 'image/png',
    size: 512
  }
};

export const testAnalysisResults = {
  technical: {
    requirements: ['ISO 9001', 'Quality control', 'Fast delivery'],
    keywords: ['electronics', 'manufacturing', 'certification'],
    confidence: 0.95,
    categories: ['electronics', 'manufacturing'],
    complexity: 'high'
  },
  parameters: {
    budget: 50000,
    deadline: '2024-12-31',
    specifications: ['ISO 9001', 'Quality control'],
    delivery: 'Fast delivery required',
    payment: 'Net 30'
  }
};

export const testNotifications = {
  email: {
    subject: 'New supplier response',
    body: 'You have received a new response from a supplier.',
    type: 'supplier_response'
  },
  system: {
    message: 'Your search request has been updated',
    type: 'request_update',
    priority: 'normal'
  }
};

export const testSettings = {
  user: {
    language: 'en',
    timezone: 'UTC',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    privacy: {
      profile_visible: true,
      contact_visible: true
    }
  },
  system: {
    maintenance_mode: false,
    registration_enabled: true,
    email_verification_required: true
  }
};

export const testErrorResponses = {
  validation: {
    status: 400,
    message: 'Validation error',
    errors: [
      {
        field: 'email',
        message: 'Invalid email format'
      }
    ]
  },
  authentication: {
    status: 401,
    message: 'Authentication required'
  },
  authorization: {
    status: 403,
    message: 'Access denied'
  },
  notFound: {
    status: 404,
    message: 'Resource not found'
  },
  serverError: {
    status: 500,
    message: 'Internal server error'
  }
};

export const testPerformanceData = {
  responseTimes: {
    fast: 100, // ms
    normal: 500, // ms
    slow: 2000, // ms
    timeout: 10000 // ms
  },
  memoryUsage: {
    low: 50, // MB
    normal: 100, // MB
    high: 200, // MB
    critical: 500 // MB
  },
  concurrentUsers: {
    low: 10,
    normal: 100,
    high: 1000,
    stress: 10000
  }
};

// Функция для получения случайных тестовых данных
export const getRandomTestData = (type: keyof typeof testUsers | keyof typeof testSearchRequests) => {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000);
  
  switch (type) {
    case 'admin':
    case 'user':
    case 'supplier':
      return {
        ...testUsers[type],
        email: `${type}-${timestamp}@test.com`,
        name: `Test ${type} ${timestamp}`
      };
    case 'electronics':
    case 'automotive':
    case 'textiles':
      return {
        ...testSearchRequests[type],
        title: `${testSearchRequests[type].title} ${timestamp}`,
        description: `${testSearchRequests[type].description} - Test ${timestamp}`
      };
    default:
      throw new Error(`Unknown test data type: ${type}`);
  }
};

// Функция для создания тестовых данных в БД
export const createTestDataInDB = async (data: any) => {
  // Здесь можно добавить логику для создания тестовых данных в БД
  console.log('Creating test data in DB:', data);
  return data;
};

// Функция для очистки тестовых данных
export const cleanupTestData = async () => {
  // Здесь можно добавить логику для очистки тестовых данных
  console.log('Cleaning up test data');
};


