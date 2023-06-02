require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const path = require('path');


/**
 * @public
 * API endpoint for translation
 */
const translationEndpoint = 'https://api.mymemory.translated.net/get';

/**
 * @public
 * Function to translate a text using an API
 */
async function translateText(text, targetLanguage) {
  try {
    const response = await axios.get(translationEndpoint, {
      params: {
        q: text,
        langpair: `sk|${targetLanguage}`,
        de: process.env.TRANSLATION_EMAIL
      }
    });
    if (response.status === 200) {
      return response.data.responseData.translatedText;
    }
  } catch (error) {
    console.error('Translation error:', error);
  }

  return text; // Return the original text if translation fails
}

/**
 * @public
 * Function to recursively translate values
 */
async function translateValues(obj, targetLanguage, translatedData = {}) {
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      const translatedArray = [];
      for (let i = 0; i < obj.length; i++) {
        const translatedValue = await translateValues(obj[i], targetLanguage, translatedData);
        translatedArray.push(translatedValue);
      }
      return translatedArray;
    } else {
      const translatedObj = {};
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (obj.hasOwnProperty(key)) {
          let translatedValue;
          if (key in translatedData) {
            translatedValue = translatedData[key]; // Use the existing translated value
          } else {
            translatedValue = await translateValues(obj[key], targetLanguage, translatedData);
            translatedData[key] = translatedValue; // Store the translated value to avoid duplicate translations
          }
          translatedObj[key] = translatedValue;
        }
      }
      return translatedObj;
    }
  } else if (typeof obj === 'string') {
    if (obj in translatedData) {
      // Skip translating if value already exists in target language data
      return translatedData[obj];
    } else {
      const translatedValue = await translateText(obj, targetLanguage); // Translate the value using the API
      translatedData[obj] = translatedValue; // Store the translated value to avoid duplicate translations
      return translatedValue;
    }
  }
  return obj;
}


/**
 * @public
 * Function to handle translation for json files
 */
function translateSKFile(skFilePath, targetLanguages) {
  try {
    // Read the input SK.json file
    const jsonDataSlovak = fs.readFile(skFilePath, function (err, data) {


      const dataSlovak = JSON.parse(data);

      // Translate new values to the target languages
      const translationPromises = targetLanguages.map(async targetLanguage => {
        const targetFilePath = path.join(path.dirname(skFilePath), `${targetLanguage.toLowerCase()}.json`);
        let jsonDataTarget = {};
        try {
          const existingDataTarget = fs.readFile(targetFilePath);
          jsonDataTarget = JSON.parse(existingDataTarget);
        } catch (error) {
          // Ignore error if the target language file doesn't exist
        }

        // Check if a value is already translated
        function isTranslated(key, newValue, translatedData) {
          return key in translatedData && newValue === translatedData[key];
        }

        // Store the order of keys in the SK.json file
        const skKeys = Object.keys(dataSlovak);

        // Translate new values to the target language
        //const translatedData = await translateValues(dataSlovak, targetLanguage);
        translateValues(dataSlovak, targetLanguage)
          .then(translatedData => {
            const updatedDataTarget = {};

            // Check if the value is new or changed
            for (let i = 0; i < skKeys.length; i++) {
              const key = skKeys[i];
              if (!isTranslated(key, translatedData[key], jsonDataTarget)) {
                updatedDataTarget[key] = translatedData[key];
              }
            }

            // Remove deleted keys from target language data
            for (let key in jsonDataTarget) {
              if (!(key in translatedData)) {
                delete jsonDataTarget[key];
              }
            }

            // Merge the translated values with the existing target language data
            const mergedDataTarget = { ...jsonDataTarget, ...updatedDataTarget };

            // Sort the translated values based on the order in SK.json
            const sortedDataTarget = {};
            for (let i = 0; i < skKeys.length; i++) {
              const key = skKeys[i];
              if (key in mergedDataTarget) {
                sortedDataTarget[key] = mergedDataTarget[key];
              }
            }

            // Write the translated JSON to the target language file
            fs.writeFile(targetFilePath, JSON.stringify(sortedDataTarget, null, 2), function (err) { });

            console.log(`Translation to ${targetLanguage.toLowerCase()} completed. Output saved to ${targetFilePath}`);
          })
          .catch(error =>{
            console.error(`Translation to ${targetLanguage.toLowerCase()} error:`, error);
          });
      });
    });
    //await Promise.all(translationPromises);
  } catch (error) {
    console.error(`Error reading ${skFilePath}:`, error);
  }
}

/**
 * @public
 * Utility function to handle user input and trigger the translation
 */
function startTranslation() {
  const args = process.argv.slice(2);
  const skFilePath = args.find(arg => arg.startsWith('--input=')).split('=')[1];
  const targetLanguages = args.find(arg => arg.startsWith('--output=')).split('=')[1].split(',');
  
  translateSKFile(skFilePath, targetLanguages)
  /*
    .then(() => {
      console.log('Translation completed for all target languages.');
    })
    .catch(error => {
      console.error('Translation error:', error);
    });
  */
   //translateSKFile(skFilePath,targetLanguages);
}

/**
 * @public
 * Call the utility function to start the translation process
 */
startTranslation();