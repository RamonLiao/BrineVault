import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuiTxService } from '../../infra/sui/sui-tx.service.js';

describe('SuiTxService', () => {
  let service: SuiTxService;

  beforeEach(() => {
    service = new SuiTxService({
      rpcUrl: 'https://fullnode.testnet.sui.io',
      packageId: '0x' + 'a'.repeat(64),
      platformKeypair: null,
    });
  });

  describe('submitSignedTx', () => {
    it('should call executeTransactionBlock with correct params', async () => {
      const mockResult = {
        digest: '0xabc',
        effects: { status: { status: 'success' } },
      };
      const mockClient = {
        executeTransactionBlock: vi.fn().mockResolvedValue(mockResult),
      };
      (service as any).client = mockClient;

      const result = await service.submitSignedTx({
        txBytes: 'base64txbytes',
        signature: 'base64sig',
      });

      expect(mockClient.executeTransactionBlock).toHaveBeenCalledWith({
        transactionBlock: 'base64txbytes',
        signature: 'base64sig',
        options: { showEffects: true, showEvents: true },
      });
      expect(result.digest).toBe('0xabc');
    });
  });

  describe('hexToBytes', () => {
    it('should convert hex string to byte array', () => {
      const result = (service as any).hexToBytes('deadbeef');
      expect(result).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });

    it('should handle empty string', () => {
      const result = (service as any).hexToBytes('');
      expect(result).toEqual([]);
    });
  });
});
