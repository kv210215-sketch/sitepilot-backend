import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SitesService } from './sites.service';
import { Site, SiteStatus } from './entities/site.entity';
import { User, UserRole } from '../users/entities/user.entity';

describe('SitesService', () => {
  let service: SitesService;

  const mockUser: User = {
    id: 'user-id-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashedPassword',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin: User = {
    ...mockUser,
    id: 'admin-id-1',
    role: UserRole.ADMIN,
  };

  const mockSite: Site = {
    id: 'site-id-1',
    name: 'Test Site',
    domain: 'https://test.com',
    description: 'A test site',
    status: SiteStatus.ACTIVE,
    sitemapUrl: 'https://test.com/sitemap.xml',
    seoEnabled: false,
    aiEnabled: false,
    owner: mockUser,
    ownerId: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitesService,
        {
          provide: getRepositoryToken(Site),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SitesService>(SitesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a site', async () => {
      mockRepository.create.mockReturnValue(mockSite);
      mockRepository.save.mockResolvedValue(mockSite);

      const result = await service.create({ name: 'Test Site', domain: 'https://test.com' }, mockUser);
      expect(result).toEqual(mockSite);
    });
  });

  describe('findAll', () => {
    it('should return all sites for admin', async () => {
      mockRepository.find.mockResolvedValue([mockSite]);
      const result = await service.findAll(mockAdmin);
      expect(result).toEqual([mockSite]);
      expect(mockRepository.find).toHaveBeenCalledWith();
    });

    it('should return only user sites for regular user', async () => {
      mockRepository.find.mockResolvedValue([mockSite]);
      const result = await service.findAll(mockUser);
      expect(result).toEqual([mockSite]);
      expect(mockRepository.find).toHaveBeenCalledWith({ where: { ownerId: mockUser.id } });
    });
  });

  describe('findOne', () => {
    it('should return a site by id for owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockSite);
      const result = await service.findOne(mockSite.id, mockUser);
      expect(result).toEqual(mockSite);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockSite);
      const otherUser = { ...mockUser, id: 'other-id' };
      await expect(service.findOne(mockSite.id, otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if site not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });
});
