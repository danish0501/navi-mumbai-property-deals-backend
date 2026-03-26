-- ══════════════════════════════════════════════════════════════════════════════
-- Navi Mumbai Property Deals — Full Database Schema
-- ══════════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS `navi_mumbai_property_deals`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `navi_mumbai_property_deals`;

-- 1. Users 
CREATE TABLE IF NOT EXISTS `users` (
  `id`           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `full_name`    VARCHAR(150)     NOT NULL,
  `email`        VARCHAR(255)     NOT NULL UNIQUE,
  `phone`        VARCHAR(20)      NOT NULL,
  `password`     VARCHAR(255)     NOT NULL,
  `role`         ENUM('user','admin') NOT NULL DEFAULT 'user',
  `avatar_url`   VARCHAR(500)     DEFAULT NULL,
  `avatar_public_id` VARCHAR(255) DEFAULT NULL,
  `is_active`    TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Properties 
CREATE TABLE IF NOT EXISTS `properties` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`                VARCHAR(300) NOT NULL UNIQUE,
  `title`               VARCHAR(300) NOT NULL,
  `purpose`             ENUM('sell','rent') NOT NULL,
  `property_type`       ENUM('residential','commercial','plot','paying-guest') NOT NULL,
  `configuration`       VARCHAR(100) DEFAULT NULL,
  `config_details`      VARCHAR(500) DEFAULT NULL,
  `posted_by`           ENUM('owner','agent','builder') NOT NULL,
  `user_id`             INT UNSIGNED DEFAULT NULL COMMENT 'FK to users if posted by registered user',

  -- Sell Pricing
  `price`               DECIMAL(15,2) DEFAULT NULL,
  `price_type`          ENUM('fixed','negotiable') DEFAULT 'fixed',
  `price_per_sqft`      DECIMAL(10,2) DEFAULT NULL,

  -- Rent Pricing
  `rent_price`          DECIMAL(10,2) DEFAULT NULL,
  `security_deposit`    DECIMAL(10,2) DEFAULT NULL,
  `maintenance`         DECIMAL(10,2) DEFAULT NULL,

  -- Verification
  `is_rera_verified`    TINYINT(1)   NOT NULL DEFAULT 0,
  `rera_number`         VARCHAR(100) DEFAULT NULL,

  -- Location
  `address`             TEXT         NOT NULL,
  `location`            VARCHAR(200) NOT NULL COMMENT 'Locality / suburb',

  -- Property specs
  `area`                DECIMAL(10,2) DEFAULT NULL COMMENT 'Area in sqft',
  `furnishing`          ENUM('unfurnished','semi-furnished','furnished') DEFAULT NULL,
  `facing`              ENUM('north','south','east','west','north-east','north-west','south-east','south-west') DEFAULT NULL,
  `floor`               VARCHAR(50)  DEFAULT NULL,
  `total_floors`        SMALLINT     DEFAULT NULL,
  `parking`             VARCHAR(100) DEFAULT NULL,
  `construction_status` ENUM('ready-to-move','under-construction','new-launch') DEFAULT NULL,
  `age`                 ENUM('0-1','1-5','5-10','10+') DEFAULT NULL,

  -- Rental extras
  `suitable_for`        VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated: family, bachelor, etc.',
  `available_from`      DATE         DEFAULT NULL,

  -- Description
  `description`         LONGTEXT     DEFAULT NULL,

  -- Status
  `status`              ENUM('active','inactive','sold','rented') NOT NULL DEFAULT 'active',
  `views`               INT UNSIGNED NOT NULL DEFAULT 0,

  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_properties_slug` (`slug`),
  INDEX `idx_properties_purpose`   (`purpose`),
  INDEX `idx_properties_type`      (`property_type`),
  INDEX `idx_properties_location`  (`location`),
  INDEX `idx_properties_status`    (`status`),
  INDEX `idx_properties_user`      (`user_id`),
  CONSTRAINT `fk_properties_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. property_images 
CREATE TABLE IF NOT EXISTS `property_images` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `url`         VARCHAR(500) NOT NULL,
  `public_id`   VARCHAR(255) NOT NULL,
  `is_cover`    TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`  SMALLINT     NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_prop_images_property` (`property_id`),
  CONSTRAINT `fk_prop_images_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. property_amenities
CREATE TABLE IF NOT EXISTS `property_amenities` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `amenity`     VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_amenities_property` (`property_id`),
  CONSTRAINT `fk_amenities_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. property_features
CREATE TABLE IF NOT EXISTS `property_features` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `feature`     VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_features_property` (`property_id`),
  CONSTRAINT `fk_features_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. property_nearby_places
CREATE TABLE IF NOT EXISTS `property_nearby_places` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` INT UNSIGNED NOT NULL,
  `name`        VARCHAR(200) NOT NULL,
  `distance`    VARCHAR(50)  NOT NULL COMMENT 'e.g. 500m, 2 km',
  `category`    VARCHAR(100) NOT NULL COMMENT 'e.g. school, hospital, metro',
  PRIMARY KEY (`id`),
  INDEX `idx_nearby_property` (`property_id`),
  CONSTRAINT `fk_nearby_property`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. blogs
CREATE TABLE IF NOT EXISTS `blogs` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`             VARCHAR(350) NOT NULL UNIQUE,
  `title`            VARCHAR(350) NOT NULL,
  `excerpt`          VARCHAR(500) DEFAULT NULL,
  `content`          LONGTEXT     NOT NULL,
  `category`         VARCHAR(100) NOT NULL,
  `cover_image_url`  VARCHAR(500) DEFAULT NULL,
  `cover_image_pub_id` VARCHAR(255) DEFAULT NULL,
  `author_name`      VARCHAR(150) NOT NULL,
  `author_role`      VARCHAR(150) DEFAULT NULL,
  `read_time`        VARCHAR(30)  DEFAULT NULL COMMENT 'e.g. 5 min read',
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `views`            INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blogs_slug` (`slug`),
  INDEX `idx_blogs_category` (`category`),
  INDEX `idx_blogs_status`   (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. blog_tags
CREATE TABLE IF NOT EXISTS `blog_tags` (
  `id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `blog_id` INT UNSIGNED NOT NULL,
  `tag`     VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_blog_tags_blog` (`blog_id`),
  CONSTRAINT `fk_blog_tags_blog`
    FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. contact_inquiries
CREATE TABLE IF NOT EXISTS `contact_inquiries` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(150) NOT NULL,
  `email`        VARCHAR(255) NOT NULL,
  `phone`        VARCHAR(20)  DEFAULT NULL,
  `enquiry_type` VARCHAR(100) DEFAULT NULL,
  `message`      TEXT         NOT NULL,
  `status`       ENUM('new','in-progress','resolved') NOT NULL DEFAULT 'new',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_contact_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. newsletter_subscribers
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`      VARCHAR(255) NOT NULL UNIQUE,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_newsletter_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
