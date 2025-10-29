/**
 * Person Service
 * Business logic for person management
 */
const Person = require('../../models/person.model');
const BaseService = require('./base.service');

class PersonService extends BaseService {
  constructor(logger) {
    super(logger);
  }

  /**
   * Create a new person
   * @param {string} userId - User ID from JWT
   * @param {Object} personData - Person data
   * @returns {Object} Created person
   */
  async createPerson(userId, personData) {
    try {
      const { name, email, phone, company, socialMedia, notes } = personData;

      const person = new Person({
        name,
        email,
        phone,
        company,
        socialMedia,
        notes,
        userId
      });

      await person.save();

      this.logSuccess('Person created successfully', {
        personId: person._id,
        userId,
        name
      });

      return person.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Create person', { userId });
    }
  }

  /**
   * Get user's people with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination and sorting options
   * @returns {Object} People with pagination
   */
  async getPeople(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'name'
      } = options;

      const result = await Person.findPaginated(
        { userId },
        { page: parseInt(page), limit: parseInt(limit), sort }
      );

      this.logSuccess('People retrieved', {
        userId,
        count: result.people.length,
        page
      });

      return result;
    } catch (error) {
      this.logAndThrow(error, 'Get people', { userId });
    }
  }

  /**
   * Get person by ID with ownership verification
   * @param {string} personId - Person ID
   * @param {string} userId - User ID
   * @returns {Object} Person details
   */
  async getPersonById(personId, userId) {
    try {
      const person = await Person.findOne({
        _id: personId,
        userId
      });

      if (!person) {
        throw new Error('Person not found');
      }

      this.logSuccess('Person retrieved', {
        personId,
        userId
      });

      return person.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Get person by ID', { personId, userId });
    }
  }

  /**
   * Update person
   * @param {string} personId - Person ID
   * @param {string} userId - User ID
   * @param {Object} updates - Update data
   * @returns {Object} Updated person
   */
  async updatePerson(personId, userId, updates) {
    try {
      const person = await Person.findOne({
        _id: personId,
        userId
      });

      if (!person) {
        throw new Error('Person not found');
      }

      // Update allowed fields
      const allowedFields = ['name', 'email', 'phone', 'company', 'socialMedia', 'notes'];
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          person[field] = updates[field];
        }
      });

      await person.save();

      this.logSuccess('Person updated', {
        personId,
        userId
      });

      return person.toSafeObject();
    } catch (error) {
      this.logAndThrow(error, 'Update person', { personId, userId });
    }
  }

  /**
   * Delete person
   * @param {string} personId - Person ID
   * @param {string} userId - User ID
   * @returns {Object} Deletion result
   */
  async deletePerson(personId, userId) {
    try {
      const person = await Person.findOne({
        _id: personId,
        userId
      });

      if (!person) {
        throw new Error('Person not found');
      }

      await person.deleteOne();

      this.logSuccess('Person deleted', {
        personId,
        userId
      });

      return {
        message: 'Person deleted successfully'
      };
    } catch (error) {
      this.logAndThrow(error, 'Delete person', { personId, userId });
    }
  }
}

module.exports = PersonService;
