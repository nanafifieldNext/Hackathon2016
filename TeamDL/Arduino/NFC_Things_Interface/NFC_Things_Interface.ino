/*
 * --------------------------------------------------------------------------------------------------------------------
 * Example sketch/program showing how to read data from a PICC to serial.
 * --------------------------------------------------------------------------------------------------------------------
 * This is a MFRC522 library example; for further details and other examples see: https://github.com/miguelbalboa/rfid
 * 
 * Example sketch/program showing how to read data from a PICC (that is: a RFID Tag or Card) using a MFRC522 based RFID
 * Reader on the Arduino SPI interface.
 * 
 * When the Arduino and the MFRC522 module are connected (see the pin layout below), load this sketch into Arduino IDE
 * then verify/compile and upload it. To see the output: use Tools, Serial Monitor of the IDE (hit Ctrl+Shft+M). When
 * you present a PICC (that is: a RFID Tag or Card) at reading distance of the MFRC522 Reader/PCD, the serial output
 * will show the ID/UID, type and any data blocks it can read. Note: you may see "Timeout in communication" messages
 * when removing the PICC from reading distance too early.
 * 
 * If your reader supports it, this sketch/program will read all the PICCs presented (that is: multiple tag reading).
 * So if you stack two or more PICCs on top of each other and present them to the reader, it will first output all
 * details of the first and then the next PICC. Note that this may take some time as all data blocks are dumped, so
 * keep the PICCs at reading distance until complete.
 * 
 * @license Released into the public domain.
 * 
 * Typical pin layout used:
 * -----------------------------------------------------------------------------------------
 *             MFRC522      Arduino       Arduino   Arduino    Arduino          Arduino
 *             Reader/PCD   Uno           Mega      Nano v3    Leonardo/Micro   Pro Micro
 * Signal      Pin          Pin           Pin       Pin        Pin              Pin
 * -----------------------------------------------------------------------------------------
 * RST/Reset   RST          9             5         D9         RESET/ICSP-5     RST
 * SPI SS      SDA(SS)      10            53        D10        10               10
 * SPI MOSI    MOSI         11 / ICSP-4   51        D11        ICSP-4           16
 * SPI MISO    MISO         12 / ICSP-1   50        D12        ICSP-1           14
 * SPI SCK     SCK          13 / ICSP-3   52        D13        ICSP-3           15
 */

#include <SPI.h>
#include <MFRC522.h>
#include "SoftwareSerial.h"
#include "TheThingsUno.h"

// RN2483 pins
#define RN_RX 3
#define RN_TX 4
#define RN_RESET 5

#define RST_PIN         9          // Configurable, see typical pin layout above
#define SS_PIN          10         // Configurable, see typical pin layout above

#define SEND_INTERVAL 60000
long lastSent = 0L;

//#define lora Serial1
SoftwareSerial lora(RN_RX, RN_TX); // RX, TX

// Set your device address - Set your address here
//const byte devAddr[4] = {0x02, 0x01, 0x2A, XXX};
const byte devAddr[4] = {0x02, 0x01, 0x1E, 0x25};

// Set your NwkSKey and AppSKey
const byte nwkSKey[16] = {0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6, 0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C};
const byte appSKey[16] = {0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6, 0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C};

#define debugSerial Serial
#define loraSerial lora

TheThingsUno ttu;

MFRC522 mfrc522(SS_PIN, RST_PIN);  // Create MFRC522 instance

String jobId = "";

void setup() {
	Serial.begin(9600);		// Initialize serial communications with the PC
	while (!Serial);		// Do nothing if no serial port is opened (added for Arduinos based on ATMEGA32U4)
	SPI.begin();			// Init SPI bus
	mfrc522.PCD_Init();		// Init MFRC522
	mfrc522.PCD_DumpVersionToSerial();	// Show details of PCD - MFRC522 Card Reader details
	Serial.println(F("Scan PICC to see UID, SAK, type, and data blocks..."));
  loraSerial.begin(57600);
  pinMode(RN_RESET, OUTPUT);
  digitalWrite(RN_RESET, HIGH);

  delay(3000);
  debugSerial.println("Initializing...");

  ttu.init(loraSerial, debugSerial);
  ttu.reset();
  ttu.personalize(devAddr, nwkSKey, appSKey);
  ttu.showStatus();

  debugSerial.println("Setup for The Things Network.");

  delay(1000);

  lastSent = millis();
}

void loop() {
	// Look for new cards
	if ( ! mfrc522.PICC_IsNewCardPresent()) {
		return;
	}

	// Select one of the cards
	if ( ! mfrc522.PICC_ReadCardSerial()) {
		return;
	}

	// Dump debug info about the card; PICC_HaltA() is automatically called
	// mfrc522.PICC_DumpToSerial(&(mfrc522.uid));
  MFRC522::StatusCode status;
  byte byteCount;
  byte buffer[18];
  byte i;
  char str [64];
  int j=0;
  
  // Try the mpages of the original Ultralight. Ultralight C has more pages.
  for (byte page = 4; page < 16; page +=4) { // Read returns data for 4 pages at a time.
    // Read pages
    byteCount = sizeof(buffer);
    status = mfrc522.MIFARE_Read(page, buffer, &byteCount);
    // Dump data
    for (byte offset = 0; offset < 4; offset++) {
      i = page + offset;
      for (byte index = 0; index < 4; index++) {
        i = 4 * offset + index;
        str[j++] = buffer[i];
      }
    }
  }

  String newJob = String(str).substring(14, 25);
  if (jobId == "") {
    jobId = newJob;
    ttu.sendString("Checkin:" + jobId);
    Serial.print("Checkin: " + jobId);
    Serial.println();
  } else if (jobId == newJob) {
    ttu.sendString("Checkout:" + jobId);
    Serial.print("Checkout: " + jobId);
    Serial.println();
    jobId = "";
  } else {
    Serial.print("Error: " + newJob + " Expected: " + jobId);
    Serial.println();
  }

  delay(5000);              // wait for 5 seconds

}

/**
 * Helper routine to dump a byte array as hex values to Serial.
 */
void dump_byte_array(byte *buffer, byte bufferSize) {
    for (byte i = 0; i < bufferSize; i++) {
        Serial.print(buffer[i] < 0x10 ? " 0" : " ");
        Serial.print(buffer[i], HEX);
    }
}
