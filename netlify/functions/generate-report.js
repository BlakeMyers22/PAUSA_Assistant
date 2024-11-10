const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to fetch historical weather data
async function getWeatherData(location, date) {
  try {
    const response = await axios.get(`http://api.weatherapi.com/v1/history.json`, {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        dt: date // format: YYYY-MM-DD
      }
    });

    const dayData = response.data.forecast.forecastday[0].day;
    const hourlyData = response.data.forecast.forecastday[0].hour;

    // Get max wind gust from hourly data
    const maxWindGust = Math.max(...hourlyData.map(hour => hour.gust_mph));
    const maxWindTime = hourlyData.find(hour => hour.gust_mph === maxWindGust)?.time || 'N/A';

    return {
      success: true,
      data: {
        maxTemp: `${dayData.maxtemp_f}°F`,
        minTemp: `${dayData.mintemp_f}°F`,
        avgTemp: `${dayData.avgtemp_f}°F`,
        maxWindGust: `${maxWindGust} mph`,
        maxWindTime: maxWindTime,
        totalPrecip: `${dayData.totalprecip_in} inches`,
        humidity: `${dayData.avghumidity}%`,
        conditions: dayData.condition.text,
        hailPossible: dayData.condition.text.toLowerCase().includes('hail') ? 'Yes' : 'No',
        thunderstorm: dayData.condition.text.toLowerCase().includes('thunder') ? 'Yes' : 'No'
      }
    };
  } catch (error) {
    console.error('Weather API Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to generate section content
async function generateSection(sectionName, context, weatherData) {
  const sectionPrompts = {
    'authorization': `You are writing the "Authorization and Scope of Investigation" section for a forensic engineering report. Use this format but vary the wording:

Background: 
- Investigation Date: ${context.investigationDate}
- Property Address: ${context.location}
- Client: ${context.clientName}
- Date of Loss: ${context.dateOfLoss}

Required Elements:
1. State the site investigation details (date, location, requestor)
2. Explain the purpose (evaluate ${context.claimType} damage from the reported date of loss)
3. Detail the scope of investigation (photo documentation, analysis, etc.)
4. Mention the appendices: 
   - Inspection Photo Report (Appendix A)
   - Roof Moisture Survey (Appendix B)
   - Meteorologist Report (Appendix C)
5. Reference any third-party reports reviewed

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'background': `You are writing the "Background Information" section for a forensic engineering report. Use this format but vary the wording:

Property Details:
- Type: ${context.propertyType}
- Age: ${context.propertyAge} years
- Construction: ${context.constructionType}
- Current Use: ${context.currentUse}
- Square Footage: ${context.squareFootage || 'To be determined'}

Required Elements:
1. Describe the building's construction type and materials
2. Detail the roof system and exterior finish
3. Include relevant architectural features
4. Note the building's current use and year built
5. Mention any relevant historical information

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'conclusions': `You are writing the "Conclusion and Recommendations" section for a forensic engineering report. Use this format but vary the wording:

Case Details:
- Damage Type: ${context.claimType}
- Weather Data: ${JSON.stringify(weatherData)}
- Affected Areas: ${context.affectedAreas.join(', ')}
- Investigation Findings: ${context.engineerNotes}

Required Elements:
1. List main conclusions as bullet points addressing:
   - Storm event impact and date
   - Weather data correlation
   - Physical evidence of damage
   - Supporting meteorological data
   - Moisture survey findings
2. Provide specific recommendations as bullet points for:
   - Required repairs/replacements
   - Scope of work needed
   - Additional considerations

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'observations': `You are writing the "Site Observations and Analysis" section for a forensic engineering report. Use this format but vary the wording:

Investigation Areas:
- Components: ${context.affectedAreas.join(', ')}
- Damage Type: ${context.claimType}
- Engineer Notes: ${context.engineerNotes}

Required Elements:
1. Initial methodology statement
2. Organize observations by component area:
   - Roof covering (if applicable)
   - Exterior components (if applicable)
   - Interior damage (if applicable)
3. For each component:
   - Detailed observations
   - Analysis of damage patterns
   - Correlation with reported cause
4. Reference photo documentation (Appendix A)

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'moisture': `You are writing the "Roof Moisture Survey" section for a forensic engineering report. Use this format but vary the wording:

Survey Details:
- Date: ${context.investigationDate}
- Equipment Used: Professional moisture detection tools
- Findings: ${context.moistureFindings || 'Detailed moisture analysis pending'}

Required Elements:
1. Describe survey methodology
2. Detail equipment used
3. Summarize findings
4. Reference full report in Appendix B
5. Note any significant moisture patterns or concerns

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'meteorologist': `You are writing the "Meteorologist Report" section for a forensic engineering report. Use this format but vary the wording:

Weather Data:
${JSON.stringify(weatherData, null, 2)}
Date of Loss: ${context.dateOfLoss}

Required Elements:
1. Summarize weather data analysis
2. Detail specific conditions:
   - Wind speeds
   - Hail occurrence
   - Precipitation
3. Correlate weather data with observed damage
4. Reference full report in Appendix C

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'rebuttal': `You are writing the "Rebuttal" section for a forensic engineering report. Use this format but vary the wording:

Dispute Details:
- Third Party Report Date: ${context.thirdPartyReportDate || 'N/A'}
- Key Disputes: ${context.keyDisputes || 'Standard analysis disputes'}
- Our Investigation Date: ${context.investigationDate}

Required Elements:
1. Reference the third-party report
2. Address key points of disagreement
3. Provide technical justification for our positions
4. Reference supporting evidence
5. Maintain professional tone

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`,
    
    'limitations': `You are writing the "Limitations" section for a forensic engineering report. Use this format but vary the wording:

Required Elements:
1. Scope limitations
2. Information available at time of report
3. Scientific and engineering certainty statement
4. Conditions present during examination
5. Confidentiality statement
6. Additional study disclaimer
7. Report use restrictions

Write in a professional engineering tone. Avoid exact copying of the sample text but maintain a similar structure and level of detail.`
  };

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert forensic engineer with extensive experience in property damage assessment and report writing. Generate professional, detailed report sections that maintain consistency with engineering standards while varying language and presentation.

Guidelines:
1. Use formal, technical language appropriate for engineering reports
2. Include specific details from the provided context
3. Maintain logical flow and clear organization
4. Support conclusions with observed evidence
5. Reference appropriate documentation and appendices
6. Avoid copying exact phrases from sample text
7. Ensure completeness of required elements`
      },
      {
        role: 'user',
        content: sectionPrompts[sectionName.toLowerCase()]
      }
    ],
    temperature: 0.7,
    max_tokens: 1000
  });

  return completion.choices[0].message.content;
}

exports.handler = async function(event, context) {
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
    const { section, context } = JSON.parse(event.body);
    
    // Format date for weather API
    const formattedDate = new Date(context.dateOfLoss).toISOString().split('T')[0];
    
    // Get weather data
    const weatherResult = await getWeatherData(context.location, formattedDate);
    
    // Generate the requested section
    const sectionContent = await generateSection(section, context, weatherResult.data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        section: sectionContent,
        sectionName: section,
        weatherData: weatherResult.data
      })
    };

  } catch (error) {
    console.error('Error:', error);
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
