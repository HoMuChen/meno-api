# Google Cloud Storage Setup on Google Compute Engine

Complete guide for configuring GCS access on GCE instances for the Meno API.

## Prerequisites

- GCE instance running the Meno API
- GCS bucket created (e.g., `menobase`)
- Google Cloud SDK (`gcloud`) installed locally for configuration

## Common Issues

### "Provided scope(s) are not authorized" Error

This error occurs when the GCE instance lacks the necessary OAuth scopes to access Cloud Storage.

**Root Causes:**
1. Instance created with default/read-only storage access scopes
2. Service account attached to instance lacks required IAM roles
3. Both conditions must be met: correct scopes AND correct IAM roles

## Solution: Configure GCE Instance for Storage Access

### Step 1: Check Current Instance Configuration

```bash
# Check instance scopes
gcloud compute instances describe INSTANCE_NAME \
  --zone=ZONE \
  --format="value(serviceAccounts[0].scopes)"

# Check service account
gcloud compute instances describe INSTANCE_NAME \
  --zone=ZONE \
  --format="value(serviceAccounts[0].email)"
```

**Expected Output:**
- Scopes should include: `https://www.googleapis.com/auth/devstorage.read_write` or `https://www.googleapis.com/auth/cloud-platform`
- Service account email (default: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`)

### Step 2: Verify Service Account IAM Roles

```bash
# Get service account email from Step 1, then check its roles
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --format="table(bindings.role)"
```

**Required Roles:**
- Minimum: `roles/storage.objectAdmin` (for the specific bucket)
- Recommended: `roles/storage.admin` (for full storage access)

**Grant Role if Missing:**
```bash
# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.objectAdmin"

# Or grant for specific bucket only
gsutil iam ch serviceAccount:SERVICE_ACCOUNT_EMAIL:objectAdmin gs://BUCKET_NAME
```

### Step 3: Update Instance Scopes (Requires Instance Restart)

**Warning:** This operation requires stopping the instance.

```bash
# Stop the instance
gcloud compute instances stop INSTANCE_NAME --zone=ZONE

# Update scopes to include storage read/write
gcloud compute instances set-service-account INSTANCE_NAME \
  --zone=ZONE \
  --scopes=https://www.googleapis.com/auth/devstorage.read_write,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write

# Or use the broader cloud-platform scope (includes all GCP services)
gcloud compute instances set-service-account INSTANCE_NAME \
  --zone=ZONE \
  --scopes=https://www.googleapis.com/auth/cloud-platform

# Start the instance
gcloud compute instances start INSTANCE_NAME --zone=ZONE
```

**Common Scope Options:**
- `devstorage.read_write` - Read/write access to Cloud Storage (recommended)
- `devstorage.full_control` - Full control of Cloud Storage
- `cloud-platform` - Full access to all Google Cloud services
- `devstorage.read_only` - Read-only storage access (insufficient for uploads)

### Step 4: Verify Configuration

After restarting the instance:

```bash
# SSH into instance
gcloud compute ssh INSTANCE_NAME --zone=ZONE

# Test authentication
gcloud auth list

# Test bucket access
gsutil ls gs://BUCKET_NAME/

# Test write permissions
echo "test" | gsutil cp - gs://BUCKET_NAME/test.txt
gsutil rm gs://BUCKET_NAME/test.txt
```

## Environment Variables on GCE

When using Application Default Credentials (ADC) on GCE, you only need:

```bash
# .env file on GCE instance
STORAGE_PROVIDER=gcs
GCS_BUCKET_NAME=your-bucket-name
GCS_PROJECT_ID=your-project-id

# GCS_KEYFILE_PATH is NOT needed when using ADC on GCE
# The instance's service account provides authentication automatically
```

## Alternative: Use Service Account Key File

If you prefer explicit authentication instead of ADC:

### Step 1: Create Service Account Key

```bash
# Create service account
gcloud iam service-accounts create meno-storage-sa \
  --display-name="Meno API Storage Service Account"

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:meno-storage-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create and download key file
gcloud iam service-accounts keys create ~/meno-gcs-key.json \
  --iam-account=meno-storage-sa@PROJECT_ID.iam.gserviceaccount.com
```

### Step 2: Upload Key to GCE Instance

```bash
# Copy key file to instance
gcloud compute scp ~/meno-gcs-key.json INSTANCE_NAME:~/meno-api/config/ --zone=ZONE

# SSH into instance and set permissions
gcloud compute ssh INSTANCE_NAME --zone=ZONE
chmod 600 ~/meno-api/config/meno-gcs-key.json
```

### Step 3: Configure Environment Variables

```bash
# .env file with explicit key file
STORAGE_PROVIDER=gcs
GCS_BUCKET_NAME=your-bucket-name
GCS_PROJECT_ID=your-project-id
GCS_KEYFILE_PATH=/home/USERNAME/meno-api/config/meno-gcs-key.json
```

## Troubleshooting

### Error: "Provided scope(s) are not authorized"

**Diagnosis:**
```bash
# Check what scopes the instance has
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/scopes
```

**Solution:** Follow Step 3 to update instance scopes

### Error: "Permission denied" or "403 Forbidden"

**Diagnosis:**
- Scopes are correct, but IAM roles are missing

**Solution:**
```bash
# Grant Storage Object Admin role to service account
gsutil iam ch serviceAccount:SERVICE_ACCOUNT_EMAIL:objectAdmin gs://BUCKET_NAME
```

### Error: "Bucket does not exist"

**Diagnosis:**
- Bucket name incorrect or bucket doesn't exist

**Solution:**
```bash
# Create bucket
gsutil mb -p PROJECT_ID -l REGION gs://BUCKET_NAME

# Verify bucket exists
gsutil ls gs://BUCKET_NAME/
```

### Authentication Method Not Clear

Check application logs for initialization message:

```
GCS storage provider initialized {
  projectId: 'your-project',
  bucket: 'your-bucket',
  authMethod: 'Application Default Credentials (ADC)' or 'Service Account Key (/path/to/key.json)',
  scopes: ['https://www.googleapis.com/auth/devstorage.read_write']
}
```

## Best Practices

### For Production (Recommended: ADC)

1. **Use Application Default Credentials** - More secure, no key file management
2. **Set minimal required scopes** - `devstorage.read_write` instead of `cloud-platform`
3. **Use dedicated service account** - Don't use default compute service account
4. **Grant least privilege IAM roles** - `roles/storage.objectAdmin` for specific bucket

### For Development

1. **Use service account key file** - Easier to debug and share across team
2. **Store key file securely** - Never commit to version control
3. **Rotate keys regularly** - Delete old keys after rotation

## Reference Commands

### Create New Instance with Correct Scopes

```bash
gcloud compute instances create INSTANCE_NAME \
  --zone=ZONE \
  --machine-type=e2-medium \
  --scopes=https://www.googleapis.com/auth/devstorage.read_write,https://www.googleapis.com/auth/logging.write \
  --service-account=SERVICE_ACCOUNT_EMAIL
```

### Update Existing Instance Metadata

```bash
# Update environment variables via startup script
gcloud compute instances add-metadata INSTANCE_NAME \
  --zone=ZONE \
  --metadata=startup-script='#!/bin/bash
    echo "STORAGE_PROVIDER=gcs" >> /home/USERNAME/meno-api/.env
    echo "GCS_BUCKET_NAME=your-bucket" >> /home/USERNAME/meno-api/.env
    echo "GCS_PROJECT_ID=your-project" >> /home/USERNAME/meno-api/.env'
```

## Related Documentation

- [Google Cloud Storage Authentication](https://cloud.google.com/storage/docs/authentication)
- [GCE Service Accounts](https://cloud.google.com/compute/docs/access/service-accounts)
- [IAM Roles for Storage](https://cloud.google.com/storage/docs/access-control/iam-roles)
- [Meno API Storage Architecture](../AUDIO_STORAGE_ARCHITECTURE.md)
