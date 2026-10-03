import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: Repository<Product>;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repo = module.get<Repository<Product>>(getRepositoryToken(Product));
    jest.clearAllMocks();
  });

  it('service is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('persists a product and returns the wrapped response', async () => {
      const dto = { name: 'Widget', price: 9.99, quantity: 10 };
      const saved = { id: 1, ...dto, status: 'FOR_SALE' };
      mockRepo.create.mockReturnValue(dto);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto as any);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.data).toMatchObject({ id: 1, name: 'Widget' });
    });
  });

  describe('findAll', () => {
    it('returns an array of products', async () => {
      mockRepo.find.mockResolvedValue([{ id: 1, name: 'A' }]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns the product with the given id', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 3, name: 'Free' });

      const result = await service.findOne(3);

      expect(result.data).toMatchObject({ id: 3 });
    });
  });
});