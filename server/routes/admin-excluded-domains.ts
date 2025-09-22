import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { excludedDomains, users } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Middleware to require admin access
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: User is not an admin' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Schema for adding excluded domain
const insertExcludedDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  reason: z.string().optional(),
});

// Function to normalize domain
const normalizeDomain = (url: string): string => {
  try {
    // Remove protocol if present
    let domain = url.replace(/^https?:\/\//, '');
    
    // Remove www. if present
    domain = domain.replace(/^www\./, '');
    
    // Remove path, query, and fragment
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    
    // Remove port if present
    domain = domain.split(':')[0];
    
    return domain.toLowerCase();
  } catch (error) {
    return url.toLowerCase();
  }
};

// GET /api/admin/excluded-domains - Get all excluded domains
router.get('/excluded-domains', requireAuth, requireAdmin, async (req, res) => {
  try {
    const domains = await db
      .select({
        id: excludedDomains.id,
        domain: excludedDomains.domain,
        reason: excludedDomains.reason,
        addedById: excludedDomains.addedById,
        createdAt: excludedDomains.createdAt,
        addedBy: {
          username: users.username,
        },
      })
      .from(excludedDomains)
      .leftJoin(users, eq(excludedDomains.addedById, users.id))
      .orderBy(desc(excludedDomains.createdAt));

    res.json(domains);
  } catch (error) {
    console.error('Error fetching excluded domains:', error);
    res.status(500).json({ error: 'Failed to fetch excluded domains' });
  }
});

// POST /api/admin/excluded-domains - Add new excluded domain
router.post('/excluded-domains', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = insertExcludedDomainSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { domain, reason } = validation.data;
    const normalizedDomain = normalizeDomain(domain);

    // Check if domain already exists
    const existingDomain = await db
      .select()
      .from(excludedDomains)
      .where(eq(excludedDomains.domain, normalizedDomain))
      .limit(1);

    if (existingDomain.length > 0) {
      return res.status(409).json({ 
        error: 'Domain already exists in the exclusion list' 
      });
    }

    // Insert new domain
    const newDomain = await db
      .insert(excludedDomains)
      .values({
        domain: normalizedDomain,
        reason: reason || 'No reason provided',
        addedById: req.user.id,
      })
      .returning();

    res.status(201).json(newDomain[0]);
  } catch (error) {
    console.error('Error adding excluded domain:', error);
    res.status(500).json({ error: 'Failed to add excluded domain' });
  }
});

// DELETE /api/admin/excluded-domains/:id - Delete excluded domain
router.delete('/excluded-domains/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid domain ID' });
    }

    // Check if domain exists
    const existingDomain = await db
      .select()
      .from(excludedDomains)
      .where(eq(excludedDomains.id, id))
      .limit(1);

    if (existingDomain.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Delete domain
    await db
      .delete(excludedDomains)
      .where(eq(excludedDomains.id, id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting excluded domain:', error);
    res.status(500).json({ error: 'Failed to delete excluded domain' });
  }
});

export default router;