import { Request, Response, NextFunction } from 'express';
import { Service } from 'typedi';
import { InitiateOwnershipTransferUseCase } from '../../../application/transfer/InitiateOwnershipTransferUseCase';
import { CancelOwnershipTransferUseCase } from '../../../application/transfer/CancelOwnershipTransferUseCase';
import { ListPendingTransfersUseCase } from '../../../application/transfer/ListPendingTransfersUseCase';
import { AcceptOwnershipTransferUseCase } from '../../../application/transfer/AcceptOwnershipTransferUseCase';
import { DeclineOwnershipTransferUseCase } from '../../../application/transfer/DeclineOwnershipTransferUseCase';
import { PetOwnershipTransferMapper } from '../../mappers/PetOwnershipTransferMapper';

@Service()
export class TransferController {
  constructor(
    private readonly initiateTransfer: InitiateOwnershipTransferUseCase,
    private readonly cancelTransfer: CancelOwnershipTransferUseCase,
    private readonly listPendingTransfers: ListPendingTransfersUseCase,
    private readonly acceptTransfer: AcceptOwnershipTransferUseCase,
    private readonly declineTransfer: DeclineOwnershipTransferUseCase,
    private readonly mapper: PetOwnershipTransferMapper,
  ) {}

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transfer = await this.initiateTransfer.execute(req.params.petId, req.auth.userId, req.body.email);
      res.status(201).json(this.mapper.toResponse(transfer));
    } catch (err) { next(err); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.cancelTransfer.execute(req.params.petId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transfers = await this.listPendingTransfers.execute(req.auth.userId);
      res.json(transfers.map((t) => this.mapper.toResponse(t)));
    } catch (err) { next(err); }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.acceptTransfer.execute(
        req.params.transferId,
        req.auth.userId,
        req.body.retainAccessForOriginalOwner === true,
      );
      res.status(204).send();
    } catch (err) { next(err); }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.declineTransfer.execute(req.params.transferId, req.auth.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
