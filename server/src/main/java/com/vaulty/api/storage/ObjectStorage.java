package com.vaulty.api.storage;

public interface ObjectStorage {

    void put(String key, byte[] content, String mimeType);

    byte[] get(String key);

    void delete(String key);
}
