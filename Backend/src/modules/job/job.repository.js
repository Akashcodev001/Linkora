import jobModel from '../../models/job.model.js';

export async function createJob(payload) {
    return jobModel.create(payload);
}

export async function attachQueueJobId(jobId, queueJobId) {
    return jobModel.findByIdAndUpdate(jobId, { $set: { queueJobId } }, { returnDocument: 'after' });
}

export async function markJobSuccess(jobId) {
    return jobModel.findByIdAndUpdate(
        jobId,
        {
            $set: { status: 'success', lastError: null },
            $inc: { attempts: 1 },
        },
        { returnDocument: 'after' }
    );
}

export async function markJobFailed(jobId, errorMessage) {
    return jobModel.findByIdAndUpdate(
        jobId,
        {
            $set: { status: 'failed', lastError: errorMessage },
            $inc: { attempts: 1 },
            $push: { errorLogs: errorMessage },
        },
        { returnDocument: 'after' }
    );
}

export async function incrementJobAttempt(jobId, errorMessage = null) {
    const update = { $inc: { attempts: 1 } };

    if (errorMessage) {
        update.$set = { lastError: errorMessage };
        update.$push = { errorLogs: errorMessage };
    }

    return jobModel.findByIdAndUpdate(jobId, update, { returnDocument: 'after' });
}

export async function findPendingJobByItemAndType(userId, itemId, type) {
    return jobModel.findOne({
        userId,
        itemId,
        type,
        status: 'pending',
    }).sort({ createdAt: -1 });
}
