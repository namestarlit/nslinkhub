-- MySQL dump 10.13  Distrib 8.0.35, for Linux (x86_64)
--
-- Host: localhost    Database: linkhub
-- ------------------------------------------------------
-- Server version	8.0.35-0ubuntu0.23.10.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `repositories`
--

DROP TABLE IF EXISTS `repositories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repositories` (
  `name` varchar(60) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_repositories_name` (`name`),
  KEY `ix_repositories_id` (`id`),
  CONSTRAINT `repositories_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repositories`
--

LOCK TABLES `repositories` WRITE;
/*!40000 ALTER TABLE `repositories` DISABLE KEYS */;
INSERT INTO `repositories` VALUES ('poetry','spoken word poetry','804d18ec-e7a5-4044-afbe-fd9825bf8f04','7e6eb4ca-d49d-4314-bbdf-593c4edbc0e7','2023-10-31 17:51:44','2023-10-31 17:51:44'),('AI','AI tools you can use','b5e0f1b8-c904-4b7f-870a-8ad680fb6807','95409333-1386-453e-9004-669d6cd13a4c','2023-10-31 17:35:42','2023-10-31 17:35:42'),('music','sleep songs','0fe57501-d702-49c0-8286-bccf08cfa836','a9cc4639-aa06-4275-84c0-255a22e74202','2023-10-31 17:24:46','2023-10-31 19:08:08'),('anime','A collection of animes to watch','0fe57501-d702-49c0-8286-bccf08cfa836','af8d56f6-551e-433b-a7be-38846253018e','2023-11-20 12:36:42','2023-11-20 12:36:42'),('novels','novel books','58782f84-5768-43b6-b541-8c65b3892e8f','ffbcdbbe-51ef-4b78-ab42-3b47f5eb2b21','2023-10-31 17:51:04','2023-10-31 17:51:04');
/*!40000 ALTER TABLE `repositories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `repository_tags`
--

DROP TABLE IF EXISTS `repository_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repository_tags` (
  `repository_id` varchar(36) DEFAULT NULL,
  `tag_id` varchar(36) DEFAULT NULL,
  KEY `repository_id` (`repository_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `repository_tags_ibfk_1` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`),
  CONSTRAINT `repository_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repository_tags`
--

LOCK TABLES `repository_tags` WRITE;
/*!40000 ALTER TABLE `repository_tags` DISABLE KEYS */;
INSERT INTO `repository_tags` VALUES ('a9cc4639-aa06-4275-84c0-255a22e74202','7f51d0f4-6953-4f07-8a25-008ad1e24e4d'),('a9cc4639-aa06-4275-84c0-255a22e74202','76b64294-fd49-4701-b13e-6e62a8fbb317'),('95409333-1386-453e-9004-669d6cd13a4c','4c90abe6-0dae-4e45-802b-8f9b9ab3678d'),('95409333-1386-453e-9004-669d6cd13a4c','b980a5d0-3267-42f8-8195-c7a496b02d4d'),('ffbcdbbe-51ef-4b78-ab42-3b47f5eb2b21','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('ffbcdbbe-51ef-4b78-ab42-3b47f5eb2b21','d9e2976e-03ca-4e27-b56e-febe1c324359'),('7e6eb4ca-d49d-4314-bbdf-593c4edbc0e7','8b8b94d7-6f0e-4c97-b330-158004ce8372'),('7e6eb4ca-d49d-4314-bbdf-593c4edbc0e7','2f2166ad-5af5-4168-a534-e93d991d00a2'),('a9cc4639-aa06-4275-84c0-255a22e74202','b980a5d0-3267-42f8-8195-c7a496b02d4d');
/*!40000 ALTER TABLE `repository_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resource_tags`
--

DROP TABLE IF EXISTS `resource_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resource_tags` (
  `resource_id` varchar(36) DEFAULT NULL,
  `tag_id` varchar(36) DEFAULT NULL,
  KEY `resource_id` (`resource_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `resource_tags_ibfk_1` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`),
  CONSTRAINT `resource_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resource_tags`
--

LOCK TABLES `resource_tags` WRITE;
/*!40000 ALTER TABLE `resource_tags` DISABLE KEYS */;
INSERT INTO `resource_tags` VALUES ('a86308cd-d2cb-4c9f-8545-d031bc3eef41','f0cdf4c4-70c7-4aa8-a892-595fee3dda23'),('a86308cd-d2cb-4c9f-8545-d031bc3eef41','76b64294-fd49-4701-b13e-6e62a8fbb317'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','ae9eb995-9b35-4117-b7ef-03923a0dba85'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','a69acfb2-e366-437f-acc8-2c0ed17197ce'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','a6127f06-7600-4128-9147-d819e7615989'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','b91a9d90-efec-455e-867c-cb6a3e4cf826'),('10eac55c-a11a-4f33-a8cc-ba7d776c86fc','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf'),('e2811a30-6505-4f78-ab5a-125c5761c463','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf'),('e2811a30-6505-4f78-ab5a-125c5761c463','ae9eb995-9b35-4117-b7ef-03923a0dba85'),('e2811a30-6505-4f78-ab5a-125c5761c463','a6127f06-7600-4128-9147-d819e7615989'),('e2811a30-6505-4f78-ab5a-125c5761c463','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('e2811a30-6505-4f78-ab5a-125c5761c463','ad5f8708-4f55-4b66-bdb1-35c845daf360'),('edebb1b8-1cbe-45fe-830c-59bf61d7191f','a6127f06-7600-4128-9147-d819e7615989'),('edebb1b8-1cbe-45fe-830c-59bf61d7191f','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('edebb1b8-1cbe-45fe-830c-59bf61d7191f','a69acfb2-e366-437f-acc8-2c0ed17197ce'),('c1d87a0a-4013-4489-a2a7-d3aa856d47d7','a69acfb2-e366-437f-acc8-2c0ed17197ce'),('c1d87a0a-4013-4489-a2a7-d3aa856d47d7','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf'),('c1d87a0a-4013-4489-a2a7-d3aa856d47d7','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('c1d87a0a-4013-4489-a2a7-d3aa856d47d7','a6127f06-7600-4128-9147-d819e7615989'),('2b4fd5ad-9770-4b25-b220-54985b49c880','b48ee45d-bc13-4c5c-9cbd-a1cdad557410'),('2b4fd5ad-9770-4b25-b220-54985b49c880','ae9eb995-9b35-4117-b7ef-03923a0dba85'),('01448fbf-aa81-4542-bfa8-b522f3c11d24','ae9eb995-9b35-4117-b7ef-03923a0dba85'),('01448fbf-aa81-4542-bfa8-b522f3c11d24','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf'),('01448fbf-aa81-4542-bfa8-b522f3c11d24','ad5f8708-4f55-4b66-bdb1-35c845daf360'),('58258fea-343f-4d87-8b39-c0e411a09092','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf'),('58258fea-343f-4d87-8b39-c0e411a09092','139a90b8-835e-492a-bfdf-5d0dd1dd4527'),('6d8f967d-b841-4a20-b24b-64fb0dc3c1d7','a6127f06-7600-4128-9147-d819e7615989'),('6d8f967d-b841-4a20-b24b-64fb0dc3c1d7','a69acfb2-e366-437f-acc8-2c0ed17197ce'),('6d8f967d-b841-4a20-b24b-64fb0dc3c1d7','912406af-614b-46ac-be8b-301557465f60'),('d1964e3a-a474-4915-b49e-1981f0d5b11f','912406af-614b-46ac-be8b-301557465f60'),('d1964e3a-a474-4915-b49e-1981f0d5b11f','f9e72b2b-93d1-4400-a6af-1752cb89e9bb'),('d1964e3a-a474-4915-b49e-1981f0d5b11f','bddbdb88-df72-49e2-a9fc-f48a99e3d380'),('66666ffb-2b32-499b-bd7d-68bc01940c14','a6127f06-7600-4128-9147-d819e7615989'),('66666ffb-2b32-499b-bd7d-68bc01940c14','ad5f8708-4f55-4b66-bdb1-35c845daf360'),('66666ffb-2b32-499b-bd7d-68bc01940c14','a69acfb2-e366-437f-acc8-2c0ed17197ce'),('66666ffb-2b32-499b-bd7d-68bc01940c14','b48ee45d-bc13-4c5c-9cbd-a1cdad557410');
/*!40000 ALTER TABLE `resource_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resources`
--

DROP TABLE IF EXISTS `resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resources` (
  `title` varchar(128) NOT NULL,
  `url` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `repository_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `repository_id` (`repository_id`),
  KEY `ix_resources_id` (`id`),
  CONSTRAINT `resources_ibfk_1` FOREIGN KEY (`repository_id`) REFERENCES `repositories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resources`
--

LOCK TABLES `resources` WRITE;
/*!40000 ALTER TABLE `resources` DISABLE KEYS */;
INSERT INTO `resources` VALUES (' Beyond the Boundary','https://gogoanime.run/category/kyoukai-no-kanata','TV Series - 2013','af8d56f6-551e-433b-a7be-38846253018e','01448fbf-aa81-4542-bfa8-b522f3c11d24','2023-11-20 13:37:10','2023-11-20 13:37:10'),('Clannad','https://gogoanime.run/category/clannad','TV Series - 2007','af8d56f6-551e-433b-a7be-38846253018e','10eac55c-a11a-4f33-a8cc-ba7d776c86fc','2023-11-20 12:48:16','2023-11-20 13:12:02'),(' The Garden of Words','https://gogoanime.run/category/kotonoha-no-niwa','Movie - 2013','af8d56f6-551e-433b-a7be-38846253018e','2b4fd5ad-9770-4b25-b220-54985b49c880','2023-11-20 13:31:26','2023-11-20 13:31:26'),('Relaxing Music','https://youtu.be/Tvb0iK5aP3Y?si=IK9-SmkuBbPYzeaB','A long playlist of only beat music','a9cc4639-aa06-4275-84c0-255a22e74202','3b900c85-8445-4a40-bef6-f30a487387e0','2023-11-01 17:23:05','2023-11-01 20:19:36'),('The thing about depression by miles carter','https://youtu.be/VCLOl6gQ-6Y?si=hcNwqq5reWeKvvmo','Spoken word poetry about depression','7e6eb4ca-d49d-4314-bbdf-593c4edbc0e7','4776210b-1380-4a3a-8196-748272098205','2023-11-01 19:30:24','2023-11-01 19:30:24'),('Midjourney','https://legacy.midjourney.com/showcase/recent/','text-to-image generative AI','95409333-1386-453e-9004-669d6cd13a4c','55364d08-e97f-401c-af1a-b9a5526141bf','2023-11-01 19:19:17','2023-11-01 19:19:17'),(' ERASED','https://gogoanime.run/category/boku-dake-ga-inai-machi','TV Series - 2016','af8d56f6-551e-433b-a7be-38846253018e','58258fea-343f-4d87-8b39-c0e411a09092','2023-11-20 13:53:32','2023-11-20 13:53:32'),('Clannad: The Movie','https://gogoanime.run/category/clannad-the-movie','Movie - 2007','af8d56f6-551e-433b-a7be-38846253018e','66666ffb-2b32-499b-bd7d-68bc01940c14','2023-11-27 15:11:57','2023-11-27 15:11:57'),('A Silent Voice','https://gogoanime.run/category/koe-no-katachi-movie','Movie - 2016','af8d56f6-551e-433b-a7be-38846253018e','6d8f967d-b841-4a20-b24b-64fb0dc3c1d7','2023-11-20 13:59:40','2023-11-20 13:59:40'),('So You Wanna Be A Writer by Charles Bukowski','https://youtu.be/gn5dYPMSjaY?si=NicQDuy7cJKhkhJY','A poem about being a writer','7e6eb4ca-d49d-4314-bbdf-593c4edbc0e7','70870d57-0206-4428-a585-216343706ec5','2023-11-01 19:32:54','2023-11-01 19:32:54'),('chatGPT','https://chat.openai.com/','text-to-text AI','95409333-1386-453e-9004-669d6cd13a4c','9966eca5-dc45-46ba-8ea2-f95208dbc502','2023-11-01 19:24:52','2023-11-01 19:24:52'),('Coding Session - Lofi Hip Hop Mix','https://youtu.be/qZjWUkohSQg','Music to listen to while coding','a9cc4639-aa06-4275-84c0-255a22e74202','a86308cd-d2cb-4c9f-8545-d031bc3eef41','2023-11-01 19:12:40','2023-11-01 19:12:40'),('Your Name','https://gogoanime.run/category/kimi-no-na-wa','Movie - 2016','af8d56f6-551e-433b-a7be-38846253018e','c1d87a0a-4013-4489-a2a7-d3aa856d47d7','2023-11-20 13:26:57','2023-11-20 13:26:57'),('Chainsaw Man','https://gogoanime.run/category/chainsaw-man','TV Series - 2022','af8d56f6-551e-433b-a7be-38846253018e','d1964e3a-a474-4915-b49e-1981f0d5b11f','2023-11-20 14:03:24','2023-11-20 14:03:24'),('Clannad After Story','https://gogoanime.run/category/clannad-after-story','TV Series - 2008','af8d56f6-551e-433b-a7be-38846253018e','e2811a30-6505-4f78-ab5a-125c5761c463','2023-11-20 13:10:47','2023-11-20 13:10:47'),('Clannad After Story: Another World – Kyou Chapter','https://gogoanime.run/category/clannad-after-story-another-world--kyou-chapter','TV Series - 2009','af8d56f6-551e-433b-a7be-38846253018e','edebb1b8-1cbe-45fe-830c-59bf61d7191f','2023-11-20 13:19:21','2023-11-20 13:19:21'),('30 Best Romance Novels No Matter What Kind of Love You are Looking For','https://www.goodhousekeeping.com/life/entertainment/g26143680/best-romance-novels/','A list of romantic novels to read','ffbcdbbe-51ef-4b78-ab42-3b47f5eb2b21','f1f32a8e-77ed-4f2b-8235-d6dc9a59464f','2023-11-01 19:39:35','2023-11-01 19:39:35'),('45 of the best romance novels of all time','https://www.panmacmillan.com/blogs/fiction/best-romance-novels-love-stories-valentines-gifts','A list of best romance novels of all times','ffbcdbbe-51ef-4b78-ab42-3b47f5eb2b21','f500e4a6-5b16-47b3-9f7f-a1f0bf97113b','2023-11-01 19:41:37','2023-11-01 19:41:37');
/*!40000 ALTER TABLE `resources` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `name` varchar(32) NOT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_tags_name` (`name`),
  KEY `ix_tags_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
INSERT INTO `tags` VALUES ('Psychological','139a90b8-835e-492a-bfdf-5d0dd1dd4527','2023-11-20 13:54:45','2023-11-20 13:54:45'),('spokenwordpoetry','2f2166ad-5af5-4168-a534-e93d991d00a2','2023-11-02 18:06:41','2023-11-02 18:06:41'),('ai','4c90abe6-0dae-4e45-802b-8f9b9ab3678d','2023-11-02 18:05:01','2023-11-02 18:05:01'),('lofi','76b64294-fd49-4701-b13e-6e62a8fbb317','2023-11-02 18:04:28','2023-11-02 18:04:28'),('music','7f51d0f4-6953-4f07-8a25-008ad1e24e4d','2023-11-02 17:58:53','2023-11-02 17:58:53'),('poetry','8b8b94d7-6f0e-4c97-b330-158004ce8372','2023-11-02 18:06:26','2023-11-02 18:06:26'),('Shounen','912406af-614b-46ac-be8b-301557465f60','2023-11-20 14:01:09','2023-11-20 14:01:09'),('Drama','a6127f06-7600-4128-9147-d819e7615989','2023-11-20 13:04:42','2023-11-20 13:04:42'),('School','a69acfb2-e366-437f-acc8-2c0ed17197ce','2023-11-20 13:04:12','2023-11-20 13:04:12'),('Fantasy','ad5f8708-4f55-4b66-bdb1-35c845daf360','2023-11-20 13:14:54','2023-11-20 13:14:54'),('SliceOfLife','ae9eb995-9b35-4117-b7ef-03923a0dba85','2023-11-20 13:00:38','2023-11-20 13:00:38'),('romance','b48ee45d-bc13-4c5c-9cbd-a1cdad557410','2023-11-02 18:05:57','2023-11-02 18:05:57'),('Comedy','b91a9d90-efec-455e-867c-cb6a3e4cf826','2023-11-20 13:04:48','2023-11-20 13:04:48'),('productivity','b980a5d0-3267-42f8-8195-c7a496b02d4d','2023-11-02 18:05:19','2023-11-02 18:05:19'),('Adventure','bddbdb88-df72-49e2-a9fc-f48a99e3d380','2023-11-20 14:04:08','2023-11-20 14:04:08'),('Supernatural','ce0660ab-89e6-478d-ba3b-c27e81ecf8bf','2023-11-20 13:05:10','2023-11-20 13:05:10'),('http','d0174a35-3ebd-4f16-8eab-52be7b57d882','2023-11-10 11:32:27','2023-11-10 11:32:27'),('storybook','d9e2976e-03ca-4e27-b56e-febe1c324359','2023-11-02 18:06:04','2023-11-02 18:06:04'),('networking','e052c047-f70e-4339-93ca-1bb63deba5bd','2023-11-10 11:06:52','2023-11-10 11:06:52'),('hiphopbeats','f0cdf4c4-70c7-4aa8-a892-595fee3dda23','2023-11-02 18:57:40','2023-11-02 18:57:40'),('Action','f9e72b2b-93d1-4400-a6af-1752cb89e9bb','2023-11-20 14:04:02','2023-11-20 14:04:02');
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `username` varchar(60) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(64) NOT NULL,
  `bio` varchar(255) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `ix_users_username` (`username`),
  KEY `ix_users_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('starlit','rainson.work@gmail.com','$2b$12$BNZMd/8JM7a9Db/sW8X2de0wTXNzFdV4RDC.lao6g0BtfGZV3omhe','Software Engineer','0fe57501-d702-49c0-8286-bccf08cfa836','2023-10-30 19:23:14','2023-12-22 10:54:07'),('effie','effie@email.com','$2b$12$G.DdsqX59D82uhHrXC.KsehHRJHmiev3Qu2gxNyL5YensLTehZwqO','the poem...','58782f84-5768-43b6-b541-8c65b3892e8f','2023-10-31 16:56:34','2023-10-31 16:56:34'),('sidori','sidori@email.com','$2b$12$1RpyX4k1391jW8.c6y1gi.YvSZHig/i9NjHUsczVdlbT4G28.TPTm','selenity','804d18ec-e7a5-4044-afbe-fd9825bf8f04','2023-10-31 16:55:36','2023-10-31 16:55:36'),('tyro','tyro@email.com','$2b$12$wjTK.0HAjb4bhIZPHhyIzOJIcXrDnVad6GVAcrLH5dkPQUr42bVW6','big time','b5e0f1b8-c904-4b7f-870a-8ad680fb6807','2023-10-31 16:56:57','2023-10-31 16:56:57');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2023-12-22 14:23:13
