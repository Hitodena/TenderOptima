import { Request, Response } from 'express';
import { db } from '../db';
import { emailReplyTemplates, InsertEmailReplyTemplate } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Функция для получения базовых шаблонов
function getDefaultImprovementTemplates(userId: number): InsertEmailReplyTemplate[] {
  return [
    {
      userId,
      name: 'Стандартный запрос',
      subject: 'Предложение об улучшении условий',
      content: `Добрый день.
В рамках текущей закупки мы получили ряд предложений. Ваше предложение - среди ключевых и находится на рассмотрении.

Поскольку цена является для нас одним из ключевых факторов выбора, текущие условия не позволяют нам сделать выбор в вашу пользу. 

В рамках процедуры закупки предлагаем улучшить условия вашего предложения и предоставить ваше обновленное предложение в течение 3 рабочих дней.

 `,
      type: 'improvement',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      name: 'Запрос Дожим 1',
      subject: 'Уточнение условий закупки',
      content: `Добрый день.

Мы проводим финальный раунд переговоров.

Для заключения контракта нам необходимо вписаться в целевой показатель [X рублей за единицу].
Мы понимаем, что это может потребовать от вас пересмотра калькуляции. 
 
Если вы сможете найти способ предложить цену, максимально приближенную к этому уровню, мы готовы немедленно подписать контракт. 
Ждем ваш окончательный ответ в течение следующего рабочего дня.
 `,
      type: 'improvement',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      name: 'Дожим Вар 1',
      subject: 'Уточнение условий закупки',
      content: `Добрый день.

Мы проводим финальный раунд переговоров с ключевыми претендентами.
Это Ваша последний возможность сделать окончательное ценовое предложение.
Другие участники уже предоставили существенные скидки, и мы ожидаем от вас максимально конкурентоспособных условий.
Пожалуйста, предоставьте вашу финальную, не подлежащую дальнейшему обсуждению цену до конца завтрашнего дня.

Решение будет принято на основе полученных предложений без дополнительных раундов.`,
      type: 'improvement',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

// GET /api/email-improvement-templates - Get all templates for current user
export async function getEmailImprovementTemplates(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Проверяем, есть ли у пользователя шаблоны в БД
    const existingTemplates = await db
      .select()
      .from(emailReplyTemplates)
      .where(
        and(
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      )
      .orderBy(emailReplyTemplates.createdAt);

    // 2. Если шаблонов нет - создаем базовые
    if (existingTemplates.length === 0) {
      console.log(`[EMAIL_TEMPLATES] No templates found for user ${userId}, creating default templates`);
      
      const defaultTemplates = getDefaultImprovementTemplates(userId);
      
      const createdTemplates = await db
        .insert(emailReplyTemplates)
        .values(defaultTemplates)
        .returning();
      
      console.log(`[EMAIL_TEMPLATES] Created ${createdTemplates.length} default templates for user ${userId}`);
      
      return res.json(createdTemplates);
    }

    // 3. Если шаблоны есть - возвращаем их
    console.log(`[EMAIL_TEMPLATES] Found ${existingTemplates.length} existing templates for user ${userId}`);
    res.json(existingTemplates);
  } catch (error) {
    console.error('Error fetching email improvement templates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch email improvement templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST /api/email-improvement-templates - Create new template
export async function createEmailImprovementTemplate(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { name, subject, content, isDefault = false } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || !subject || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, subject, content' 
      });
    }

    // If setting as default, unset other defaults for this user
    if (isDefault) {
      await db
        .update(emailReplyTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(emailReplyTemplates.userId, userId),
            eq(emailReplyTemplates.type, 'improvement')
          )
        );
    }

    const newTemplate: InsertEmailReplyTemplate = {
      userId,
      name: name.trim(),
      subject: subject.trim(),
      content: content.trim(),
      type: 'improvement',
      isDefault,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [createdTemplate] = await db
      .insert(emailReplyTemplates)
      .values(newTemplate)
      .returning();

    res.status(201).json(createdTemplate);
  } catch (error) {
    console.error('Error creating email improvement template:', error);
    res.status(500).json({ 
      error: 'Failed to create template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// PUT /api/email-improvement-templates/:id - Update template
export async function updateEmailImprovementTemplate(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const templateId = parseInt(req.params.id);
    const { name, subject, content, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    if (!name || !subject || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, subject, content' 
      });
    }

    // Check if template exists and belongs to user
    const existingTemplate = await db
      .select()
      .from(emailReplyTemplates)
      .where(
        and(
          eq(emailReplyTemplates.id, templateId),
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      )
      .limit(1);

    if (existingTemplate.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If setting as default, unset other defaults for this user
    if (isDefault) {
      await db
        .update(emailReplyTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(emailReplyTemplates.userId, userId),
            eq(emailReplyTemplates.type, 'improvement')
          )
        );
    }

    const [updatedTemplate] = await db
      .update(emailReplyTemplates)
      .set({
        name: name.trim(),
        subject: subject.trim(),
        content: content.trim(),
        isDefault: isDefault || false,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(emailReplyTemplates.id, templateId),
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      )
      .returning();

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating email improvement template:', error);
    res.status(500).json({ 
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// DELETE /api/email-improvement-templates/:id - Delete template
export async function deleteEmailImprovementTemplate(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const templateId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!templateId || isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Check if template exists and belongs to user
    const existingTemplate = await db
      .select()
      .from(emailReplyTemplates)
      .where(
        and(
          eq(emailReplyTemplates.id, templateId),
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      )
      .limit(1);

    if (existingTemplate.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db
      .delete(emailReplyTemplates)
      .where(
        and(
          eq(emailReplyTemplates.id, templateId),
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      );

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting email improvement template:', error);
    res.status(500).json({ 
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST /api/email-improvement-templates/reset-to-defaults - Reset user templates to defaults
export async function resetEmailImprovementTemplatesToDefaults(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Удаляем все существующие шаблоны пользователя
    await db
      .delete(emailReplyTemplates)
      .where(
        and(
          eq(emailReplyTemplates.userId, userId),
          eq(emailReplyTemplates.type, 'improvement')
        )
      );

    // 2. Создаем базовые шаблоны
    const defaultTemplates = getDefaultImprovementTemplates(userId);
    
    const createdTemplates = await db
      .insert(emailReplyTemplates)
      .values(defaultTemplates)
      .returning();

    console.log(`[EMAIL_TEMPLATES] Reset to default templates for user ${userId}`);
    res.json(createdTemplates);
  } catch (error) {
    console.error('Error resetting email improvement templates:', error);
    res.status(500).json({ 
      error: 'Failed to reset email improvement templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
