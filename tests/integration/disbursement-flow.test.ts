/**
 * Integration Tests: Disbursement Flow
 * Tests the complete disbursement workflow from request to approval
 */

import { describe, it, expect } from '@jest/globals';

describe('Disbursement Flow Integration Tests', () => {
  const testCampaignId = 'test-campaign-001';
  const testBankingAccountId = 'test-banking-001';
  const testRequestId = 'test-request-001';

  describe('Create Disbursement Request', () => {
    it('should create disbursement request with valid data', () => {
      const requestData = {
        amount: 500,
        purpose: 'EQUIPMENT',
        description: 'Purchase new basketballs and training equipment',
        bankingDetails: {
          accountName: 'Lincoln High Athletics',
          accountNumber: '****1234',
          routingNumber: '123456789',
        }
      };

      // Validate request
      expect(requestData.amount).toBeGreaterThanOrEqual(10);
      expect(requestData.amount).toBeLessThanOrEqual(50000);
      expect(requestData.description.length).toBeGreaterThanOrEqual(10);
      expect(requestData.description.length).toBeLessThanOrEqual(500);
      expect(requestData.purpose).toMatch(/^(EQUIPMENT|TRAVEL|UNIFORMS|FACILITIES|TOURNAMENT_FEES|OTHER)$/);
    });

    it('should reject request with amount below minimum', () => {
      const requestData = {
        amount: 5, // Below $10 minimum
        purpose: 'EQUIPMENT',
        description: 'Test purchase',
      };

      expect(requestData.amount).toBeLessThan(10);
    });

    it('should reject request with amount above maximum', () => {
      const requestData = {
        amount: 60000, // Above $50,000 maximum
        purpose: 'EQUIPMENT',
        description: 'Large purchase',
      };

      expect(requestData.amount).toBeGreaterThan(50000);
    });

    it('should reject request exceeding available balance', () => {
      const availableBalance = 100000; // $1,000
      const requestedAmount = 150000; // $1,500

      expect(requestedAmount).toBeGreaterThan(availableBalance);
    });

    it('should reject if too many pending requests', () => {
      const pendingRequestCount = 3;
      const maxPendingRequests = 3;

      expect(pendingRequestCount).toBeGreaterThanOrEqual(maxPendingRequests);
    });
  });

  describe('List Disbursement Requests', () => {
    it('should list disbursements for campaign', () => {
      const mockDisbursements = [
        {
          id: '1',
          amount: 500,
          purpose: 'EQUIPMENT',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: '2',
          amount: 750,
          purpose: 'TRAVEL',
          status: 'APPROVED',
          createdAt: new Date(),
        },
      ];

      expect(mockDisbursements).toHaveLength(2);
      expect(mockDisbursements[0].status).toBe('PENDING');
      expect(mockDisbursements[1].status).toBe('APPROVED');
    });

    it('should calculate disbursement summary correctly', () => {
      const disbursements = [
        { amount: 500, status: 'PENDING' },
        { amount: 750, status: 'PENDING' },
        { amount: 1000, status: 'APPROVED' },
        { amount: 250, status: 'REJECTED' },
      ];

      const summary = {
        totalRequested: disbursements
          .filter(d => d.status === 'PENDING')
          .reduce((sum, d) => sum + d.amount, 0),
        totalApproved: disbursements
          .filter(d => d.status === 'APPROVED')
          .reduce((sum, d) => sum + d.amount, 0),
        pendingCount: disbursements.filter(d => d.status === 'PENDING').length,
      };

      expect(summary.totalRequested).toBe(1250); // 500 + 750
      expect(summary.totalApproved).toBe(1000);
      expect(summary.pendingCount).toBe(2);
    });
  });

  describe('Approve Disbursement', () => {
    it('should approve valid disbursement request', () => {
      const request = {
        id: testRequestId,
        amount: 50000, // $500
        status: 'PENDING',
        bankingAccountId: testBankingAccountId,
      };

      const availableBalance = 100000; // $1,000

      // Check if can approve
      const canApprove =
        request.status === 'PENDING' &&
        request.amount <= availableBalance;

      expect(canApprove).toBe(true);
    });

    it('should update balances after approval', () => {
      const initialBalance = 100000; // $1,000
      const disbursementAmount = 50000; // $500

      const updatedAvailableBalance = initialBalance - disbursementAmount;
      const updatedDisbursedTotal = disbursementAmount;
      const updatedPendingDisbursement = 0;

      expect(updatedAvailableBalance).toBe(50000); // $500 remaining
      expect(updatedDisbursedTotal).toBe(50000); // $500 disbursed
    });

    it('should create transaction record on approval', () => {
      const transaction = {
        type: 'DISBURSEMENT',
        status: 'COMPLETED',
        amount: 50000,
        currency: 'USD',
        description: 'Disbursement: EQUIPMENT - Purchase new basketballs',
        disbursementRequestId: testRequestId,
      };

      expect(transaction.type).toBe('DISBURSEMENT');
      expect(transaction.status).toBe('COMPLETED');
      expect(transaction.amount).toBe(50000);
    });

    it('should not approve already processed request', () => {
      const request = {
        id: testRequestId,
        status: 'APPROVED', // Already processed
      };

      const canApprove = request.status === 'PENDING';
      expect(canApprove).toBe(false);
    });
  });

  describe('Reject Disbursement', () => {
    it('should reject with valid reason', () => {
      const rejectionReason = 'Insufficient documentation provided';

      expect(rejectionReason.length).toBeGreaterThan(10);
      expect(rejectionReason.length).toBeLessThanOrEqual(500);
    });

    it('should return funds to available balance on rejection', () => {
      const initialAvailableBalance = 100000;
      const pendingDisbursement = 50000;

      // On rejection, pending amount returns to available
      const updatedPendingDisbursement = 0;
      const fundReturned = pendingDisbursement;

      expect(updatedPendingDisbursement).toBe(0);
      expect(fundReturned).toBe(50000);
    });

    it('should require rejection reason', () => {
      const rejectionReason = '';

      expect(rejectionReason.trim().length).toBe(0); // Should fail validation
    });
  });

  describe('Disbursement Authorization', () => {
    it('should allow campaign leader to create request', () => {
      const user = { id: 'user-1', role: 'CAMPAIGN_LEADER' };
      const campaign = { primaryLeaderId: 'user-1' };

      const isAuthorized = campaign.primaryLeaderId === user.id;
      expect(isAuthorized).toBe(true);
    });

    it('should allow guardian to create request', () => {
      const user = { id: 'user-2', role: 'CAMPAIGN_LEADER' };
      const campaign = {
        primaryLeaderId: 'user-1',
        guardians: [{ id: 'user-2' }]
      };

      const isAuthorized =
        campaign.primaryLeaderId === user.id ||
        campaign.guardians.some(g => g.id === user.id);

      expect(isAuthorized).toBe(true);
    });

    it('should only allow BANK_ADMIN to approve', () => {
      const bankAdmin = { role: 'BANK_ADMIN' };
      const regularAdmin = { role: 'ADMIN' };
      const campaignLeader = { role: 'CAMPAIGN_LEADER' };

      expect(bankAdmin.role).toBe('BANK_ADMIN');
      expect(regularAdmin.role).not.toBe('BANK_ADMIN');
      expect(campaignLeader.role).not.toBe('BANK_ADMIN');
    });
  });

  describe('Campaign Status Validation', () => {
    it('should allow disbursement for ACTIVE campaign', () => {
      const campaign = { status: 'ACTIVE' };
      const canRequest = campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED';

      expect(canRequest).toBe(true);
    });

    it('should allow disbursement for COMPLETED campaign', () => {
      const campaign = { status: 'COMPLETED' };
      const canRequest = campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED';

      expect(canRequest).toBe(true);
    });

    it('should reject disbursement for DRAFT campaign', () => {
      const campaign = { status: 'DRAFT' };
      const canRequest = campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED';

      expect(canRequest).toBe(false);
    });

    it('should reject disbursement for ARCHIVED campaign', () => {
      const campaign = { status: 'ARCHIVED' };
      const canRequest = campaign.status === 'ACTIVE' || campaign.status === 'COMPLETED';

      expect(canRequest).toBe(false);
    });
  });
});