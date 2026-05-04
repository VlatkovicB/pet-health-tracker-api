import {
  JsonController, Get, Patch, Put, Delete,
  Param, Body, QueryParams, UseBefore, CurrentUser, OnUndefined,
} from 'routing-controllers';
import { Service } from 'typedi';
import { authMiddleware, AuthPayload } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { Validate } from '../decorators/Validate';
import { ListUsersUseCase } from '../../../application/admin/ListUsersUseCase';
import { GetUserStatsUseCase } from '../../../application/admin/GetUserStatsUseCase';
import { UpdateUserRoleUseCase } from '../../../application/admin/UpdateUserRoleUseCase';
import { UpsertUserLimitsUseCase } from '../../../application/admin/UpsertUserLimitsUseCase';
import { DeleteUserUseCase } from '../../../application/admin/DeleteUserUseCase';
import { UpdateUserRoleSchema, UpdateUserRoleBody, UpsertUserLimitsSchema, UpsertUserLimitsBody } from '../schemas/adminSchemas';
import { PaginationQuerySchema, PaginationQuery } from '../schemas/petSchemas';

@JsonController('/admin')
@Service()
@UseBefore(authMiddleware, requireAdmin)
export class AdminController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUserStats: GetUserStatsUseCase,
    private readonly updateRole: UpdateUserRoleUseCase,
    private readonly upsertLimits: UpsertUserLimitsUseCase,
    private readonly deleteUser: DeleteUserUseCase,
  ) {}

  @Get('/users')
  @Validate({ query: PaginationQuerySchema })
  async list(@QueryParams() query: PaginationQuery) {
    return this.listUsers.execute(query);
  }

  @Get('/users/:userId')
  async getUser(@Param('userId') userId: string) {
    return this.getUserStats.execute(userId);
  }

  @Patch('/users/:userId/role')
  @Validate({ body: UpdateUserRoleSchema })
  async setRole(
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleBody,
    @CurrentUser() user: AuthPayload,
  ) {
    await this.updateRole.execute({ targetUserId: userId, role: body.role, requestingUserId: user.userId });
    return { success: true };
  }

  @Put('/users/:userId/limits')
  @Validate({ body: UpsertUserLimitsSchema })
  async setLimits(@Param('userId') userId: string, @Body() body: UpsertUserLimitsBody) {
    await this.upsertLimits.execute({ targetUserId: userId, limits: body });
    return { success: true };
  }

  @Delete('/users/:userId')
  @OnUndefined(204)
  async delete(@Param('userId') userId: string, @CurrentUser() user: AuthPayload) {
    await this.deleteUser.execute({ targetUserId: userId, requestingUserId: user.userId });
  }
}
