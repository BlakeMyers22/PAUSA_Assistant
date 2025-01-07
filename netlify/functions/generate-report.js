/************************************************
 * netlify/functions/generate-report.js
 ************************************************/
const OpenAI = require('openai');
const axios = require('axios');

/**
 * Initialize OpenAI with your API key.
 * Ensure OPENAI_API_KEY is set in your Netlify environment.
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Utility function: Safely convert a value to a string,
 * returning fallback if it's null/undefined or empty.
 */
function safeString(value, fallback = '') {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return fallback;
}

/**
 * Utility function: Safely join an array. If it's not a valid array,
 * or it's empty, return an empty string.
 */
function safeArrayJoin(arr, separator = ', ') {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.join(separator);
  }
  return '';
}

/**
 * Utility function: Safely parse a date.
 * If parsing fails or the input is missing, return null.
 */
function safeParseDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Fetch historical weather data with safe checks.
 * If the date is in the future or unavailable, we'll handle that gracefully.
 */
async function getWeatherData(location, dateString) {
  try {
    if (!location || !dateString) {
      return { success: true, data: {} };
    }
    const dateObj = safeParseDate(dateString);
    if (!dateObj) {
      return { success: true, data: {} };
    }

    // If the date is after "today", skip.
    const today = new Date();
    if (dateObj > today) {
      return { 
        success: true, 
        data: {
          note: `Weather data not found for future date: ${dateObj.toISOString().split('T')[0]}`
        } 
      };
    }

    const formattedDate = dateObj.toISOString().split('T')[0];

    // Attempt call to WeatherAPI
    const response = await axios.get('http://api.weatherapi.com/v1/history.json', {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        dt: formattedDate
      }
    });

    const dayData = response.data.forecast.forecastday[0].day;
    const hourlyData = response.data.forecast.forecastday[0].hour;
    const maxWindGust = Math.max(...hourlyData.map(hour => hour.gust_mph));
    const maxWindTime = hourlyData.find(hour => hour.gust_mph === maxWindGust)?.time || '';

    return {
      success: true,
      data: {
        maxTemp: `${dayData.maxtemp_f}°F`,
        minTemp: `${dayData.mintemp_f}°F`,
        avgTemp: `${dayData.avgtemp_f}°F`,
        maxWindGust: `${maxWindGust} mph`,
        maxWindTime,
        totalPrecip: `${dayData.totalprecip_in} inches`,
        humidity: `${dayData.avghumidity}%`,
        conditions: dayData.condition.text,
        hailPossible: dayData.condition.text.toLowerCase().includes('hail') ? 'Yes' : 'No',
        thunderstorm: dayData.condition.text.toLowerCase().includes('thunder') ? 'Yes' : 'No'
      }
    };
  } catch (error) {
    console.error('Weather API Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build the prompt for each section, with explicit instructions
 * to avoid placeholders or contradictory roofing information, etc.
 */
async function generateSectionPrompt(sectionName, context, weatherData, customInstructions = '') {
  // Safely deconstruct fields from context
  const investigationDate   = safeString(context?.investigationDate);
  const dateOfLoss          = safeString(context?.dateOfLoss);
  const claimTypeString     = safeArrayJoin(context?.claimType);
  const propertyType        = safeString(context?.propertyType);
  const propertyAge         = safeString(context?.propertyAge);
  const constructionType    = safeString(context?.constructionType);
  const currentUse          = safeString(context?.currentUse);
  const squareFootage       = safeString(context?.squareFootage);
  const address             = safeString(context?.address);
  const clientName          = safeString(context?.clientName);
  const projectName         = safeString(context?.projectName);
  const propertyOwnerName   = safeString(context?.propertyOwnerName);

  // Affected areas
  const affectedAreas       = safeArrayJoin(context?.affectedAreas);

  // Additional data: single-story vs. multi-story
  // (We can guess from "propertyType" or user inputs. 
  //  If not explicitly set, we won't mention floors.)
  // For simplicity, let's assume a single-story if user doesn't mention anything else.

  // Engineer credentials
  const engineerName    = safeString(context?.engineerName);
  const engineerEmail   = safeString(context?.engineerEmail);
  const engineerLicense = safeString(context?.engineerLicense);
  const engineerPhone   = safeString(context?.engineerPhone);

  // Weather data or note
  let weatherSummary = '';
  if (weatherData?.note) {
    weatherSummary = `Weather Data Note: ${weatherData.note}`;
  } else if (Object.keys(weatherData || {}).length > 0) {
    weatherSummary = JSON.stringify(weatherData, null, 2);
  }

  // We can also build a "Roof Types" string for GPT to remain consistent with. 
  // If the user’s form context included TPO or Single-Ply Membrane or Composition Shingles, etc. 
  // We can pass a short mention here. 
  // Example logic: (We keep it simple for illustration.)
  let roofTypesDetected = '';
  if (context?.roofType?.length) {
    roofTypesDetected = `The user indicates these roof types: ${context.roofType.join(', ')}.`;
  } else {
    // Or derive from checkboxes?
    // (In your real code, you might want to parse checkboxes and build a short list.)
    // This is left as a placeholder: you can adapt it to your data collection approach.
    roofTypesDetected = 'The user indicates a TPO or other single-ply membrane if checked.';
  }

  // Big system instructions to keep GPT from fabricating or contradicting:
  const bigSystemInstruction = `
You are an expert forensic engineer generating professional report sections. 
Use only the data from user inputs, do not invent or contradict them.

Key instructions for consistency:
1. Do NOT invent roofing types that the user did not specify. 
2. If user says it is a single-story building, do NOT mention an upper floor. 
3. If user specifically says TPO is punctured by hail, do not mention asphalt shingles. 
4. If user has not indicated any opposing third-party reports, keep the Rebuttal section minimal. 
5. If the user has indicated interior water intrusion, mention it. Otherwise, do not. 
6. We have two separate dates: 
   - Date of Loss (DOL): ${dateOfLoss}
   - Investigation (Inspection) Date: ${investigationDate}
   Do NOT conflate them. 
7. If weather data is not available, note that it was not retrieved or it was a future date. 
8. Do NOT use placeholders such as [e.g., ...], [Third Party], [N/A], etc. If data is missing, remain concise. 
9. The user’s claim type is: ${claimTypeString}
10. The building’s property type is: ${propertyType}, with an age of ${propertyAge} years, and used for ${currentUse}. 
11. The building’s address is ${address}. The client name is ${clientName} or ${propertyOwnerName}.
12. The roof type should only come from user data. 
${roofTypesDetected}

Weather Data Summary:
${weatherSummary}
`;

  // A dictionary of base prompts
  const basePrompts = {
    introduction: `
You are writing the "Introduction" for a forensic engineering report.

Consider:
- The property is located at "${address}".
- The reason for inspection is related to claims of: ${claimTypeString}.
- The Date of Loss is ${dateOfLoss}, while the inspection date is ${investigationDate}.
- Summarize the purpose of the inspection and the alleged damage (hail, wind, foundation, etc.).

Maintain a concise, professional tone and do NOT mention placeholders or contradictory roofing details.
`,

    authorization: `
You are writing the "Authorization and Scope of Investigation" section.
Include:
1) Who authorized the investigation (the property owner, law firm, insurer, etc. if known from input).
2) The scope of work performed (visual inspection, photos, etc.).
3) Summarize major tasks performed.
4) Mention any attached documents or references.

Remain professional and concise. Do not invent contradictory details.
`,

    background: `
You are writing the "Background Information" section.
Property details to include if relevant:
- Property Type: ${propertyType}
- Age: ${propertyAge} years
- Construction Type: ${constructionType}
- Current Use: ${currentUse}
- Square Footage: ${squareFootage}
- Address: ${address}
- Project Name: ${projectName}
- Property Owner: ${propertyOwnerName}

Do not introduce contradictory materials or placeholders.
`,

    observations: `
You are writing the "Site Observations and Analysis" section.
User indicates the following affected areas: ${affectedAreas}.
User claim type(s): ${claimTypeString}.

If user indicated TPO hail punctures, mention them. 
Do NOT mention asphalt shingles or multi-story interior if user didn't specify them. 
Reference photos or tests only if the user mentions them. 
`,

    moisture: `
You are writing the "Survey" (Moisture) section.
Use the user’s data about water intrusion or the lack thereof.
If the user indicated water intrusion or moisture, mention it. Otherwise, do not fabricate it.
`,

    meteorologist: `
You are writing the "Meteorologist Report" section.
Use the data from:
${weatherSummary}

If date is in the future or data is not available, simply note that. 
Focus on how wind, hail, or precipitation might relate to the user’s claim.
`,

    conclusions: `
You are writing the "Conclusions and Recommendations" section.
Summarize:
- The cause of loss (based on user input).
- The recommended next steps or repairs.
Do NOT add placeholders like [e.g., ...] or conflicting details.
`,

    rebuttal: `
You are writing the "Rebuttal" section. 
Only include a rebuttal if the user has indicated the existence of third-party or conflicting reports. 
Otherwise, keep it minimal or note that no conflicting reports were provided.
`,

    limitations: `
You are writing the "Limitations" section.
Mention typical disclaimers about scope, data reliance, etc.
No placeholders, please.
`,

    tableofcontents: `
You are generating a "Table of Contents" in markdown for the forensic engineering report. 
Ensure it includes the Opening Letter. The final order is:
1. Opening Letter
2. Introduction
3. Authorization and Scope of Investigation
4. Background Information
5. Site Observations and Analysis
6. Survey
7. Meteorologist Report
8. Conclusions and Recommendations
9. Rebuttal
10. Limitations
`,

    openingletter: `
You are writing an "Opening Letter" for the final forensic engineering report.
It should appear before the Table of Contents.

Include:
- The Date of Loss: ${dateOfLoss}
- The Investigation Date: ${investigationDate}
- The Claim Type(s): ${claimTypeString}
- The Property Address: ${address}
- A brief greeting and statement of the purpose of this report
- Signature block with the engineer’s name, license, email, and phone
`
  };

  const normalizedSection = (sectionName || '').trim().toLowerCase();

  const fallbackPrompt = `Write a professional section titled "${sectionName}". Use only user inputs; do not add placeholders.`;

  const basePrompt = basePrompts[normalizedSection] || fallbackPrompt;

  const safeCustom = safeString(customInstructions, '');
  const finalPrompt = safeCustom
    ? `${basePrompt}\n\nAdditional Regeneration Instructions:\n${safeCustom}`
    : basePrompt;

  // Merge with the big system instruction to keep GPT consistent:
  const fullPrompt = `
${bigSystemInstruction}

User has requested the "${sectionName}" section. 
${finalPrompt}
`;

  return fullPrompt;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { section, context: userContext, customInstructions } = JSON.parse(event.body) || {};

    // Attempt weather fetch for sections other than tableOfContents/openingLetter/introduction
    let weatherResult = { success: true, data: {} };
    const lowerSection = (section || '').trim().toLowerCase();

    if (!['tableofcontents', 'openingletter', 'introduction'].includes(lowerSection)) {
      const dateObj = safeParseDate(userContext?.dateOfLoss);
      if (dateObj && userContext?.address) {
        // Attempt to get weather data
        weatherResult = await getWeatherData(userContext.address, dateObj.toISOString().split('T')[0]);
      }
    }

    // Build prompt
    const prompt = await generateSectionPrompt(section, userContext, weatherResult.data, customInstructions);

    // Create the chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', 
      // or if you have gpt-4 or enterprise model
      // model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      temperature: 0.0, // Reduce creativity to avoid contradictions
      max_tokens: 3000
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        section: completion.choices[0].message.content || '',
        sectionName: section,
        weatherData: weatherResult.data
      })
    };
  } catch (error) {
    console.error('Error in generate-report function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate report section',
        details: error.message
      })
    };
  }
};
