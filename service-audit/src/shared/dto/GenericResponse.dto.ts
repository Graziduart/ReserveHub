export class GenericResponseDto {
  message: string;
  createdAt: Date;

  constructor(message: string) {
    this.message = message;
    this.createdAt = new Date();
  }
}
