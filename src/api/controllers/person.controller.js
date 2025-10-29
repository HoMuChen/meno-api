/**
 * Person Controller
 * Handles HTTP requests for person endpoints
 */
const BaseController = require('./base.controller');

class PersonController extends BaseController {
  constructor(personService, logger) {
    super(personService, logger);
    this.personService = personService;
  }

  /**
   * Create a new person
   */
  create = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const person = await this.personService.createPerson(userId, req.body);
    return this.sendCreated(res, person, 'Person created successfully');
  });

  /**
   * Get user's people
   */
  list = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const { page, limit, sort } = req.query;

    const result = await this.personService.getPeople(userId, {
      page,
      limit,
      sort
    });

    return this.sendSuccess(res, result);
  });

  /**
   * Get person by ID
   */
  getById = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const person = await this.personService.getPersonById(req.params.id, userId);
    return this.sendSuccess(res, person);
  });

  /**
   * Update person
   */
  update = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const person = await this.personService.updatePerson(req.params.id, userId, req.body);
    return this.sendSuccess(res, person, 'Person updated successfully');
  });

  /**
   * Delete person
   */
  delete = this.asyncHandler(async (req, res) => {
    const userId = this.getUserId(req);
    const result = await this.personService.deletePerson(req.params.id, userId);
    return this.sendSuccess(res, {}, result.message);
  });
}

module.exports = PersonController;
