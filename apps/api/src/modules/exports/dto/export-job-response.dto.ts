export class ExportJobResponseDto {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}
