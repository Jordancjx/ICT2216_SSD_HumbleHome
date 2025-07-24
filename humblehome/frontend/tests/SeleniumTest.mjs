import { Builder, By, until } from 'selenium-webdriver';
import assert from 'assert';

// Get the argument (default to 'local' if not provided)
const environment = process.argv[2] || 'local';

// URLs based on environment
// Obtain dev selenium server IP using: docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' selenium-server
const seleniumUrl = environment === 'github' 
  ? 'http://selenium:4444/wd/hub' 
  : 'http://localhost:4444/wd/hub';

// Note: Start the nodejs server before running the test locally
const serverUrl = environment === 'github' 
  ? 'http://testserver:3000' 
  : 'http://host.docker.internal:3000';

console.log(`Running tests in '${environment}' environment`);
console.log(`Selenium URL: ${seleniumUrl}`);
console.log(`Server URL: ${serverUrl}`);

(async function testTimestamp() {

    console.log("before driver init")

    // Initialize the WebDriver with Chrome
    const driver = environment === 'github' 
        ? await new Builder()
        .forBrowser('chrome')
        .usingServer(seleniumUrl) // Specify the Selenium server
        .build()
        : await new Builder()
        .forBrowser('chrome')
        .usingServer(seleniumUrl) // Specify the Selenium server
        .build();


    try {

        console.log("after driver init")
        
        await driver.get(serverUrl);

        console.log("after driver.get serverUrl")

        // Wait for the timestamp to appear on the page
        let timestampElement = await driver.wait(
            until.elementLocated(By.id('timestamp')), // Assuming the timestamp has an id of 'timestamp'
            5000 // Timeout in milliseconds
        );

        // Get the timestamp text
        let timestampText = await timestampElement.getText();
        console.log(`Timestamp: ${timestampText}`);

        // Extract the actual timestamp after "Server timestamp: "
        const timestampMatch = timestampText.match(/Server timestamp:\s*(.*)/);
        assert.ok(timestampMatch, 'Timestamp text does not match expected format');
        const extractedTimestamp = timestampMatch[1];

        // Validate the timestamp format (ISO 8601 format)
        const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        assert.match(extractedTimestamp, timestampRegex, 'Timestamp format is invalid');
        console.log('Timestamp format is valid.');

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        // Quit the browser session
        await driver.quit();
    }
})();
