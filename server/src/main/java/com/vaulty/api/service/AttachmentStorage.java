package com.vaulty.api.service;

import com.vaulty.api.exception.AttachmentStorageException;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class AttachmentStorage {
    private final S3Client client;
    private final String bucket;
    private final boolean autoCreateBucket;
    private volatile boolean bucketReady;

    public AttachmentStorage(@Value("${app.storage.endpoint:}") String endpoint,
                             @Value("${app.storage.region:us-east-1}") String region,
                             @Value("${app.storage.bucket:vaulty-attachments}") String bucket,
                             @Value("${app.storage.access-key:}") String accessKey,
                             @Value("${app.storage.secret-key:}") String secretKey,
                             @Value("${app.storage.auto-create-bucket:false}") boolean autoCreateBucket) {
        this.bucket = bucket;
        this.autoCreateBucket = autoCreateBucket;
        this.client = endpoint.isBlank() || accessKey.isBlank() || secretKey.isBlank() ? null
                : S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of(region))
                        .forcePathStyle(true)
                        .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                        .build();
    }

    public void put(String key, byte[] bytes, String mimeType) {
        ensureBucket();
        try {
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(mimeType).build(),
                    RequestBody.fromBytes(bytes));
        } catch (RuntimeException failure) {
            throw new AttachmentStorageException();
        }
    }

    public byte[] get(String key) {
        ensureBucket();
        try {
            return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (RuntimeException failure) {
            throw new AttachmentStorageException();
        }
    }

    public void delete(String key) {
        ensureBucket();
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (RuntimeException failure) {
            throw new AttachmentStorageException();
        }
    }

    private synchronized void ensureBucket() {
        if (client == null) {
            throw new AttachmentStorageException();
        }
        if (bucketReady) {
            return;
        }
        try {
            client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (S3Exception missing) {
            if (!autoCreateBucket || missing.statusCode() != 404) {
                throw new AttachmentStorageException();
            }
            try {
                client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            } catch (S3Exception concurrent) {
                if (concurrent.statusCode() != 409) {
                    throw new AttachmentStorageException();
                }
            }
        } catch (RuntimeException failure) {
            throw new AttachmentStorageException();
        }
        bucketReady = true;
    }
}
