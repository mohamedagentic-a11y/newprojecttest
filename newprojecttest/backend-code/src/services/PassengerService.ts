import bcrypt from 'bcrypt';
import { PassengerRepository, PassengerProfile, UpdateProfilePayload, ExportJob } from '../repositories/PassengerRepository';
import { TokenService, TokenPayload } from '../services/TokenService';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  profile: PassengerProfile;
}

export interface ExportJobResult {
  exportJobId: string;
  status: string;
}

export class PassengerService {
  private passengerRepository: PassengerRepository;
  private tokenService: TokenService;

  constructor(passengerRepository: PassengerRepository, tokenService: TokenService) {
    this.passengerRepository = passengerRepository;
    this.tokenService = tokenService;
  }

  async authenticate(email: string, password: string): Promise<AuthResult> {
    const passenger = await this.passengerRepository.findByEmail(email);
    if (!passenger) {
      throw new Error('Invalid email or password');
    }

    // The PassengerProfile does not carry a password_hash field in the given interface,
    // so we need to compare against whatever the repository exposes.
    // Because findByEmail returns PassengerProfile (no password_hash in interface),
    // we cast to access the field that the DB row will carry but isn't in the interface type.
    const raw = passenger as PassengerProfile & { password_hash?: string };
    if (!raw.password_hash) {
      throw new Error('Invalid email or password');
    }

    const match = await bcrypt.compare(password, raw.password_hash);
    if (!match) {
      throw new Error('Invalid email or password');
    }

    const payload: TokenPayload = {
      passenger_id: passenger.passenger_id,
      tier_status: passenger.tier_status,
      role: 'Leisure Passenger' as any,
      preferred_language: passenger.preferred_language,
    };

    const accessToken = this.tokenService.signAccessToken(payload);
    const refreshToken = this.tokenService.signRefreshToken(passenger.passenger_id);

    return {
      accessToken,
      refreshToken,
      profile: passenger,
    };
  }

  async getProfile(passengerId: string): Promise<PassengerProfile> {
    const passenger = await this.passengerRepository.findById(passengerId);
    if (!passenger) {
      throw new Error('Passenger not found');
    }
    return passenger;
  }

  async updateProfile(passengerId: string, payload: UpdateProfilePayload): Promise<PassengerProfile> {
    const existing = await this.passengerRepository.findById(passengerId);
    if (!existing) {
      throw new Error('Passenger not found');
    }

    const updated = await this.passengerRepository.updateProfile(passengerId, payload);
    if (!updated) {
      throw new Error('Failed to update passenger profile');
    }

    return updated;
  }

  async initiateDataExport(passengerId: string): Promise<ExportJobResult> {
    const passenger = await this.passengerRepository.findById(passengerId);
    if (!passenger) {
      throw new Error('Passenger not found');
    }

    const exportJob: ExportJob = await this.passengerRepository.createExportJob(passengerId);

    return {
      exportJobId: exportJob.export_job_id,
      status: exportJob.status,
    };
  }
}