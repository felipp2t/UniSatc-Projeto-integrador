package com.vaulty.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VaultyApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(VaultyApiApplication.class, args);
        System.out.println("======= START API =======");
    }
}
