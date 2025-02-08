from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import os
import time
import requests
from datetime import datetime
from PIL import Image
import base64
import io

class WhatsAppImageMonitor:
    def __init__(self, group_name, target_number=None):
        self.group_name = group_name
        self.target_number = target_number
        self.driver = self._setup_driver()
        self.storage_path = "downloaded_images"
        
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)

    def _setup_driver(self):
        options = webdriver.ChromeOptions()
        options.add_argument("--user-data-dir=selenium")
        driver = webdriver.Chrome(options=options)
        return driver

    def start_monitoring(self):
        # Open WhatsApp Web
        self.driver.get("https://web.whatsapp.com")
        input("Scan QR code and press Enter after logging in...")

        # Navigate to the group
        self._navigate_to_group()
        
        print(f"Monitoring {self.group_name} for images...")
        
        # Start continuous monitoring
        while True:
            try:
                # Look for new images
                images = self.driver.find_elements(By.CSS_SELECTOR, "img[src^='data:image']")
                
                for img in images:
                    sender = self._get_message_sender(img)
                    
                    # If target number is specified, check if this message is from that number
                    if self.target_number and sender != self.target_number:
                        continue
                        
                    # Download image
                    self._save_image(img)
                
                time.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                print(f"Error: {str(e)}")
                time.sleep(5)

    def _navigate_to_group(self):
        # Wait for search box and click it
        search_box = WebDriverWait(self.driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div[title='Search input textbox']"))
        )
        search_box.click()
        search_box.send_keys(self.group_name)
        
        # Wait and click on the group
        group = WebDriverWait(self.driver, 20).until(
            EC.presence_of_element_located((By.XPATH, f"//span[@title='{self.group_name}']"))
        )
        group.click()

    def _get_message_sender(self, img_element):
        try:
            # Navigate up the DOM to find the message container and sender info
            message_container = img_element.find_element(By.XPATH, "./ancestor::div[contains(@class, 'message-in')]")
            sender_element = message_container.find_element(By.CSS_SELECTOR, "span.selectable-text")
            return sender_element.text
        except:
            return None

    def _save_image(self, img_element):
        try:
            # Get image source
            img_src = img_element.get_attribute("src")
            
            if img_src.startswith("data:image"):
                # Convert base64 to image
                img_data = base64.b64decode(img_src.split(",")[1])
                img = Image.open(io.BytesIO(img_data))
                
                # Generate filename with timestamp
                filename = f"whatsapp_image_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                filepath = os.path.join(self.storage_path, filename)
                
                # Save image
                img.save(filepath)
                print(f"Saved image: {filepath}")
                
                # Here you could add code to upload to cloud storage
                self._upload_to_cloud(filepath)

        except Exception as e:
            print(f"Error saving image: {str(e)}")

    def _upload_to_cloud(self, filepath):
        # Implement your cloud storage upload logic here
        # Example for AWS S3:
        """
        import boto3
        s3 = boto3.client('s3')
        bucket_name = 'your-bucket-name'
        s3.upload_file(filepath, bucket_name, os.path.basename(filepath))
        """
        pass

if __name__ == "__main__":
    GROUP_NAME = "Your Group Name"
    TARGET_NUMBER = "1234567890"  # Optional: specify number in international format
    
    monitor = WhatsAppImageMonitor(GROUP_NAME, TARGET_NUMBER)
    monitor.start_monitoring() 