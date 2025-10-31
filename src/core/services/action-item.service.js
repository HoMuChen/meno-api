/**
 * Action Item Service
 * Database operations for action items
 */
const ActionItem = require('../../models/action-item.model');
const BaseService = require('./base.service');

class ActionItemService extends BaseService {
  constructor(logger) {
    super(logger);
    this.ActionItem = ActionItem;
  }

  /**
   * Create action items in bulk from LLM output
   * @param {string} meetingId - Meeting ID
   * @param {Array} actionItemsData - Array of action item data
   * @returns {Promise<Array>} Created action items
   */
  async createActionItems(meetingId, actionItemsData) {
    try {
      const items = actionItemsData.map(item => ({
        ...item,
        meetingId
      }));

      const savedActionItems = await this.ActionItem.bulkInsert(items);

      this.logSuccess('Action items created', {
        meetingId,
        count: savedActionItems.length
      });

      return savedActionItems;
    } catch (error) {
      this.logAndThrow(error, 'Create action items', { meetingId, itemCount: actionItemsData.length });
    }
  }

  /**
   * Get action items for a meeting with pagination
   * @param {string} meetingId - Meeting ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Action items with pagination
   */
  async getActionItemsByMeetingId(meetingId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'createdAt'
      } = options;

      const query = { meetingId };

      const result = await this.ActionItem.findPaginated(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: true
      });

      this.logSuccess('Action items retrieved', {
        meetingId,
        count: result.actionItems.length,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get action items by meeting', { meetingId, options });
    }
  }

  /**
   * Get action items for a person with pagination
   * @param {string} personId - Person ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Action items with pagination
   */
  async getActionItemsByPersonId(personId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50
      } = options;

      const query = { personId };

      const result = await this.ActionItem.findPaginated(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: 'createdAt',
        populate: true
      });

      this.logSuccess('Action items retrieved for person', {
        personId,
        count: result.actionItems.length,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get action items by person', { personId, options });
    }
  }

  /**
   * Get action items for a user with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Action items with pagination
   */
  async getUserActionItems(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = 'createdAt'
      } = options;

      const query = { userId };

      const result = await this.ActionItem.findPaginated(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: true
      });

      this.logSuccess('Action items retrieved for user', {
        userId,
        count: result.actionItems.length,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get action items by user', { userId, options });
    }
  }

  /**
   * Get single action item by ID
   * @param {string} actionItemId - Action item ID
   * @returns {Promise<Object>} Action item
   */
  async getActionItemById(actionItemId) {
    try {
      const actionItem = await this.ActionItem.findById(actionItemId)
        .populate('personId', 'name email company')
        .populate('meetingId', 'title projectId');

      if (!actionItem) {
        throw new Error('Action item not found');
      }

      return actionItem;
    } catch (error) {
      this.logAndThrow(error, 'Get action item by ID', { actionItemId });
    }
  }

  /**
   * Update an action item
   * @param {string} actionItemId - Action item ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated action item
   */
  async updateActionItem(actionItemId, updates) {
    try {
      const allowedUpdates = ['task', 'assignee', 'personId', 'dueDate', 'context', 'status'];
      const filteredUpdates = {};

      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      const actionItem = await this.ActionItem.findByIdAndUpdate(
        actionItemId,
        filteredUpdates,
        { new: true, runValidators: true }
      ).populate('personId', 'name email company');

      if (!actionItem) {
        throw new Error('Action item not found');
      }

      this.logSuccess('Action item updated', {
        actionItemId,
        updates: Object.keys(filteredUpdates)
      });

      return actionItem;
    } catch (error) {
      this.logAndThrow(error, 'Update action item', { actionItemId, updates });
    }
  }

  /**
   * Delete an action item
   * @param {string} actionItemId - Action item ID
   * @returns {Promise<Object>} Deleted action item
   */
  async deleteActionItem(actionItemId) {
    try {
      const actionItem = await this.ActionItem.findByIdAndDelete(actionItemId);

      if (!actionItem) {
        throw new Error('Action item not found');
      }

      this.logSuccess('Action item deleted', { actionItemId });

      return actionItem;
    } catch (error) {
      this.logAndThrow(error, 'Delete action item', { actionItemId });
    }
  }

  /**
   * Delete all action items for a meeting (cleanup)
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteActionItemsByMeetingId(meetingId) {
    try {
      const result = await this.ActionItem.deleteMany({ meetingId });

      this.logSuccess('Action items deleted for meeting', {
        meetingId,
        deletedCount: result.deletedCount
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Delete action items by meeting', { meetingId });
    }
  }

  /**
   * Get action item counts by status for a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Status counts
   */
  async getActionItemsCountsByStatus(meetingId) {
    try {
      const counts = await this.ActionItem.countByStatus(meetingId);

      return counts;
    } catch (error) {
      this.logAndThrow(error, 'Get action items counts by status', { meetingId });
    }
  }
}

module.exports = ActionItemService;
