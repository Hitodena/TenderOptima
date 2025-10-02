/**
 * Моки и стабы для тестирования
 */

// Мок для OpenAI API
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Mocked AI response for testing'
            }
          }
        ]
      })
    }
  }
};

// Мок для SendGrid
export const mockSendGrid = {
  send: jest.fn().mockResolvedValue({
    statusCode: 202,
    body: 'Mocked email sent'
  })
};

// Мок для базы данных
export const mockDatabase = {
  users: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  searchRequests: {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  suppliers: {
    findById: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
};

// Мок для файловой системы
export const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  existsSync: jest.fn()
};

// Мок для HTTP запросов
export const mockHttpClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

// Мок для сессий
export const mockSession = {
  userId: 1,
  isAuthenticated: true,
  destroy: jest.fn(),
  regenerate: jest.fn()
};

// Мок для Socket.IO
export const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  disconnect: jest.fn()
};

// Мок для внешних API
export const mockExternalAPIs = {
  yandex: {
    search: jest.fn().mockResolvedValue({
      results: [
        {
          title: 'Mocked Yandex Result',
          url: 'https://example.com',
          description: 'Mocked description'
        }
      ]
    })
  },
  google: {
    search: jest.fn().mockResolvedValue({
      results: [
        {
          title: 'Mocked Google Result',
          url: 'https://example.com',
          description: 'Mocked description'
        }
      ]
    })
  }
};

// Мок для email сервиса
export const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendBulkEmail: jest.fn().mockResolvedValue(true),
  validateEmail: jest.fn().mockReturnValue(true)
};

// Мок для файловых загрузок
export const mockFileUpload = {
  single: jest.fn(),
  array: jest.fn(),
  fields: jest.fn()
};

// Мок для валидации
export const mockValidation = {
  validateEmail: jest.fn().mockReturnValue(true),
  validatePassword: jest.fn().mockReturnValue(true),
  validatePhone: jest.fn().mockReturnValue(true),
  validateUrl: jest.fn().mockReturnValue(true)
};

// Мок для кэширования
export const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn()
};

// Мок для логирования
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Мок для rate limiting
export const mockRateLimit = {
  check: jest.fn().mockResolvedValue(true),
  increment: jest.fn(),
  reset: jest.fn()
};

// Мок для CSRF защиты
export const mockCSRF = {
  generateToken: jest.fn().mockReturnValue('mock-csrf-token'),
  validateToken: jest.fn().mockReturnValue(true)
};

// Мок для аутентификации
export const mockAuth = {
  authenticate: jest.fn().mockResolvedValue(true),
  authorize: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
  verifyToken: jest.fn().mockReturnValue({ userId: 1, role: 'user' })
};

// Мок для обработки файлов
export const mockFileProcessor = {
  extractText: jest.fn().mockResolvedValue('Mocked extracted text'),
  validateFile: jest.fn().mockReturnValue(true),
  getFileInfo: jest.fn().mockReturnValue({
    size: 1024,
    type: 'text/plain',
    name: 'test.txt'
  })
};

// Мок для поиска поставщиков
export const mockSupplierSearch = {
  search: jest.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Mocked Supplier',
      email: 'supplier@example.com',
      rating: 4.5,
      categories: ['electronics']
    }
  ]),
  getById: jest.fn().mockResolvedValue({
    id: 1,
    name: 'Mocked Supplier',
    email: 'supplier@example.com'
  })
};

// Мок для анализа документов
export const mockDocumentAnalysis = {
  analyze: jest.fn().mockResolvedValue({
    requirements: ['quality', 'delivery'],
    keywords: ['electronics', 'manufacturing'],
    confidence: 0.95
  }),
  extractParameters: jest.fn().mockResolvedValue({
    budget: 10000,
    deadline: '2024-12-31',
    specifications: ['ISO 9001']
  })
};

// Функция для сброса всех моков
export const resetAllMocks = () => {
  Object.values(mockOpenAI).forEach(mock => {
    if (typeof mock === 'function') mock.mockClear();
  });
  
  Object.values(mockSendGrid).forEach(mock => {
    if (typeof mock === 'function') mock.mockClear();
  });
  
  Object.values(mockDatabase).forEach(table => {
    Object.values(table).forEach(mock => {
      if (typeof mock === 'function') mock.mockClear();
    });
  });
  
  // Сброс других моков...
  mockEmailService.sendEmail.mockClear();
  mockFileSystem.readFile.mockClear();
  mockHttpClient.get.mockClear();
  mockSession.destroy.mockClear();
  mockSocket.emit.mockClear();
  mockExternalAPIs.yandex.search.mockClear();
  mockCache.get.mockClear();
  mockLogger.info.mockClear();
  mockRateLimit.check.mockClear();
  mockCSRF.generateToken.mockClear();
  mockAuth.authenticate.mockClear();
  mockFileProcessor.extractText.mockClear();
  mockSupplierSearch.search.mockClear();
  mockDocumentAnalysis.analyze.mockClear();
};

// Функция для настройки моков по умолчанию
export const setupDefaultMocks = () => {
  // Настройка моков для успешных операций
  mockDatabase.users.create.mockResolvedValue({ id: 1, email: 'test@example.com' });
  mockDatabase.users.findById.mockResolvedValue({ id: 1, email: 'test@example.com' });
  mockDatabase.searchRequests.create.mockResolvedValue({ id: 1, title: 'Test Request' });
  mockEmailService.sendEmail.mockResolvedValue(true);
  mockFileSystem.existsSync.mockReturnValue(true);
  mockHttpClient.get.mockResolvedValue({ data: 'Mocked response' });
  mockCache.get.mockResolvedValue(null);
  mockRateLimit.check.mockResolvedValue(true);
  mockCSRF.validateToken.mockReturnValue(true);
  mockAuth.authenticate.mockResolvedValue(true);
  mockFileProcessor.validateFile.mockReturnValue(true);
  mockSupplierSearch.search.mockResolvedValue([]);
  mockDocumentAnalysis.analyze.mockResolvedValue({ requirements: [], keywords: [] });
};


