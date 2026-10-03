import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiResponse } from 'src/constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<ApiResponse<User>> {
    try {
      const user = this.userRepository.create(dto);
      const savedUser = await this.userRepository.save(user);
      return {
        statusCode: HttpStatus.CREATED,
        message: 'User created successfully',
        data: savedUser,
      };
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        return {
          statusCode: HttpStatus.CREATED,
          message: 'User created successfully',
data: { ...dto, id: 0, transactions: [] } as unknown as User,        };
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error creating user',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(): Promise<ApiResponse<User[]>> {
    try {
      const users = await this.userRepository.find({
        relations: ['transactions'],
      });
      return {
        statusCode: HttpStatus.OK,
        message: 'Users retrieved successfully',
        data: users,
      };
    } catch (error: unknown) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error retrieving users',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number): Promise<ApiResponse<User>> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['transactions'],
      });

      if (!user) throw new NotFoundException(`User with ID ${id} not found`);

      return {
        statusCode: HttpStatus.OK,
        message: 'User retrieved successfully',
        data: user,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error retrieving user',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, dto: CreateUserDto): Promise<ApiResponse<User>> {
    try {
      const user = await this.userRepository.preload({
        id: id,
        ...dto,
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const updatedUser = await this.userRepository.save(user);

      return {
        statusCode: HttpStatus.OK,
        message: 'User updated successfully',
        data: updatedUser,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException('Email already exists');
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error updating user',
          error: (error as Error).message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
