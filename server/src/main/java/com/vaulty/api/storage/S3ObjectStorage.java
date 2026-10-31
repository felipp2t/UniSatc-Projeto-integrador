package com.vaulty.api.storage;

import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

public class S3ObjectStorage implements ObjectStorage {

    private final S3Client client;
    private final String bucket;

    public S3ObjectStorage(S3Client client, String bucket) {
        this.client = client;
        this.bucket = bucket;
    }

    @Override
    public void put(String key, byte[] content, String mimeType) {
        try {
            client.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(key).contentType(mimeType).build(),
                    RequestBody.fromBytes(content));
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    @Override
    public byte[] get(String key) {
        try {
            return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    @Override
    public void delete(String key) {
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (SdkException exception) {
            throw storageFailure(exception);
        }
    }

    private StorageOperationException storageFailure(SdkException cause) {
        return new StorageOperationException("Object storage operation failed", cause);
    }
}
