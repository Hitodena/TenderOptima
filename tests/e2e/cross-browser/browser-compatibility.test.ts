import { test, expect } from '@playwright/test';

test.describe('Cross-Browser Compatibility Tests', () => {
  test('Chrome browser compatibility', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome specific test');
    
    await test.step('Test Chrome-specific features', async () => {
      await page.goto('/');
      
      // Проверяем поддержку современных CSS функций
      await expect(page.locator('[data-testid="css-grid-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="flexbox-layout"]')).toBeVisible();
      
      // Проверяем поддержку Web APIs
      await page.evaluate(() => {
        // Проверяем наличие современных API
        expect(typeof IntersectionObserver).toBe('function');
        expect(typeof ResizeObserver).toBe('function');
        expect(typeof MutationObserver).toBe('function');
      });
    });

    await test.step('Test Chrome performance', async () => {
      const startTime = Date.now();
      
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Проверяем, что загрузка происходит быстро в Chrome
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test('Firefox browser compatibility', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox specific test');
    
    await test.step('Test Firefox-specific features', async () => {
      await page.goto('/');
      
      // Проверяем поддержку CSS Grid в Firefox
      await expect(page.locator('[data-testid="css-grid-layout"]')).toBeVisible();
      
      // Проверяем поддержку Flexbox
      await expect(page.locator('[data-testid="flexbox-layout"]')).toBeVisible();
      
      // Проверяем поддержку CSS Custom Properties
      await page.evaluate(() => {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        expect(computedStyle.getPropertyValue('--primary-color')).toBeTruthy();
      });
    });

    await test.step('Test Firefox form handling', async () => {
      await page.goto('/send-request');
      
      // Проверяем работу форм в Firefox
      await page.fill('input[name="title"]', 'Firefox Test');
      await page.fill('textarea[name="description"]', 'Testing Firefox compatibility');
      
      // Проверяем валидацию форм
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    });

    await test.step('Test Firefox performance', async () => {
      const startTime = Date.now();
      
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Проверяем производительность в Firefox
      expect(loadTime).toBeLessThan(6000);
    });
  });

  test('Safari browser compatibility', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari specific test');
    
    await test.step('Test Safari-specific features', async () => {
      await page.goto('/');
      
      // Проверяем поддержку CSS Grid в Safari
      await expect(page.locator('[data-testid="css-grid-layout"]')).toBeVisible();
      
      // Проверяем поддержку Flexbox
      await expect(page.locator('[data-testid="flexbox-layout"]')).toBeVisible();
      
      // Проверяем поддержку CSS Custom Properties
      await page.evaluate(() => {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        expect(computedStyle.getPropertyValue('--primary-color')).toBeTruthy();
      });
    });

    await test.step('Test Safari form handling', async () => {
      await page.goto('/send-request');
      
      // Проверяем работу форм в Safari
      await page.fill('input[name="title"]', 'Safari Test');
      await page.fill('textarea[name="description"]', 'Testing Safari compatibility');
      
      // Проверяем валидацию форм
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Запрос создан успешно')).toBeVisible();
    });

    await test.step('Test Safari performance', async () => {
      const startTime = Date.now();
      
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      await expect(page.locator('[data-testid="supplier-card"]')).toHaveCount.greaterThan(0);
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Проверяем производительность в Safari
      expect(loadTime).toBeLessThan(7000);
    });
  });

  test('Cross-browser feature detection', async ({ page }) => {
    await test.step('Test feature detection', async () => {
      await page.goto('/');
      
      // Проверяем поддержку различных функций
      const features = await page.evaluate(() => {
        return {
          cssGrid: CSS.supports('display', 'grid'),
          flexbox: CSS.supports('display', 'flex'),
          customProperties: CSS.supports('--custom', 'value'),
          webGL: !!document.createElement('canvas').getContext('webgl'),
          webGL2: !!document.createElement('canvas').getContext('webgl2'),
          intersectionObserver: typeof IntersectionObserver !== 'undefined',
          resizeObserver: typeof ResizeObserver !== 'undefined',
          mutationObserver: typeof MutationObserver !== 'undefined'
        };
      });
      
      // Проверяем, что основные функции поддерживаются
      expect(features.cssGrid).toBe(true);
      expect(features.flexbox).toBe(true);
      expect(features.customProperties).toBe(true);
      expect(features.intersectionObserver).toBe(true);
      expect(features.mutationObserver).toBe(true);
    });

    await test.step('Test graceful degradation', async () => {
      await page.goto('/');
      
      // Проверяем, что приложение работает даже без некоторых функций
      await page.evaluate(() => {
        // Имитируем отсутствие некоторых функций
        delete window.IntersectionObserver;
        delete window.ResizeObserver;
      });
      
      // Проверяем, что приложение все еще работает
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
    });
  });

  test('Cross-browser layout consistency', async ({ page }) => {
    await test.step('Test layout consistency', async () => {
      await page.goto('/');
      
      // Проверяем основные элементы макета
      const layoutElements = [
        '[data-testid="header"]',
        '[data-testid="main-navigation"]',
        '[data-testid="main-content"]',
        '[data-testid="footer"]'
      ];
      
      for (const selector of layoutElements) {
        await expect(page.locator(selector)).toBeVisible();
      }
    });

    await test.step('Test responsive layout', async () => {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1024, height: 768, name: 'Laptop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('/');
        
        // Проверяем, что макет адаптируется
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
        
        // Проверяем, что навигация работает
        await page.click('text=Поиск поставщиков');
        await expect(page).toHaveURL(/.*search.*/);
      }
    });

    await test.step('Test typography consistency', async () => {
      await page.goto('/');
      
      // Проверяем, что шрифты загружаются корректно
      const fontFamilies = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const families = new Set();
        
        elements.forEach(el => {
          const computedStyle = getComputedStyle(el);
          families.add(computedStyle.fontFamily);
        });
        
        return Array.from(families);
      });
      
      // Проверяем, что используются правильные шрифты
      expect(fontFamilies.length).toBeGreaterThan(0);
    });
  });

  test('Cross-browser JavaScript compatibility', async ({ page }) => {
    await test.step('Test JavaScript features', async () => {
      await page.goto('/');
      
      // Проверяем поддержку современных JavaScript функций
      const jsFeatures = await page.evaluate(() => {
        return {
          asyncAwait: (async () => {})().constructor.name === 'AsyncFunction',
          arrowFunctions: (() => {}).toString().includes('=>'),
          templateLiterals: `test`.includes('test'),
          destructuring: (() => { const {a} = {a: 1}; return a === 1; })(),
          spreadOperator: (() => { const arr = [...[1, 2, 3]]; return arr.length === 3; })(),
          classes: (() => { class Test {}; return typeof Test === 'function'; })(),
          modules: typeof import !== 'undefined',
          promises: typeof Promise !== 'undefined',
          fetch: typeof fetch !== 'undefined'
        };
      });
      
      // Проверяем, что основные функции поддерживаются
      expect(jsFeatures.asyncAwait).toBe(true);
      expect(jsFeatures.arrowFunctions).toBe(true);
      expect(jsFeatures.templateLiterals).toBe(true);
      expect(jsFeatures.destructuring).toBe(true);
      expect(jsFeatures.spreadOperator).toBe(true);
      expect(jsFeatures.classes).toBe(true);
      expect(jsFeatures.promises).toBe(true);
      expect(jsFeatures.fetch).toBe(true);
    });

    await test.step('Test error handling', async () => {
      await page.goto('/');
      
      // Проверяем, что ошибки JavaScript обрабатываются корректно
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Выполняем действия, которые могут вызвать ошибки
      await page.goto('/search');
      await page.fill('input[placeholder*="поиск"]', 'electronics');
      await page.click('button[type="submit"]');
      
      // Проверяем, что критических ошибок нет
      const criticalErrors = errors.filter(error => 
        error.includes('ReferenceError') || 
        error.includes('TypeError') || 
        error.includes('SyntaxError')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test('Cross-browser performance comparison', async ({ page, browserName }) => {
    await test.step('Test performance metrics', async () => {
      await page.goto('/');
      
      // Измеряем время загрузки страницы
      const loadTime = await page.evaluate(() => {
        return performance.timing.loadEventEnd - performance.timing.navigationStart;
      });
      
      // Проверяем, что загрузка происходит в разумное время
      expect(loadTime).toBeLessThan(10000);
    });

    await test.step('Test memory usage', async () => {
      await page.goto('/search');
      
      // Измеряем использование памяти
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        // Проверяем, что использование памяти в разумных пределах
        const memoryUsagePercent = (memoryInfo.used / memoryInfo.limit) * 100;
        expect(memoryUsagePercent).toBeLessThan(80);
      }
    });

    await test.step('Test rendering performance', async () => {
      await page.goto('/search');
      
      // Измеряем время рендеринга
      const renderTime = await page.evaluate(() => {
        const start = performance.now();
        
        // Имитируем тяжелые операции рендеринга
        for (let i = 0; i < 1000; i++) {
          document.createElement('div');
        }
        
        const end = performance.now();
        return end - start;
      });
      
      // Проверяем, что рендеринг происходит быстро
      expect(renderTime).toBeLessThan(100);
    });
  });
});


