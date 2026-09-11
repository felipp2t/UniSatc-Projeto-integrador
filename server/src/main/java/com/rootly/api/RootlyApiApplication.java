package com.rootly.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RootlyApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(RootlyApiApplication.class, args);
        System.out.println("======= START API =======");
    }
}
