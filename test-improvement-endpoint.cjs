// Тест для проверки endpoint /api/improvement-request
require('dotenv').config({ path: '.env' });

const testData = {
  requestId: 682,
  supplierEmail: "compncc1@gmail.com",
  supplierName: "НСС Comp",
  subject: "Предложение об улучшении условий",
  message: "Тестовое сообщение для проверки endpoint"
};

console.log('Тестируем endpoint /api/improvement-request с данными:', testData);

fetch('http://localhost:5000/api/improvement-request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => {
  console.log('Статус ответа:', response.status);
  return response.text();
})
.then(data => {
  console.log('Ответ сервера:', data);
})
.catch(error => {
  console.error('Ошибка:', error);
});
