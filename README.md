# Science Live - Simplified Nanopublication Processor

This simplified version of Science Live removes the intermediate "Load Nanopublications" step and directly processes nanopublications through a Python backend.

## 🏗️ Architecture Overview

```
User Input → Netlify Function → GitHub Actions → Python Processor → Results
```

### Key Changes Made

1. **Removed intermediate loading step** - Users can now directly execute nanopublications
2. **Streamlined UI** - Single "Execute Nanopublications" button
3. **Enhanced Python processor** - More robust fetching, validation, and analysis
4. **Direct workflow** - Simplified user experience with immediate processing

## 📁 File Structure

```
public/                     # Frontend files (served by Netlify)
├── index.html             # Simplified main interface
├── app.js                 # Streamlined JavaScript
├── styles.css             # Updated styles
└── logo.png              

netlify/functions/          # Serverless functions
└── process-nanopubs.js    # Updated function for direct processing

scripts/                   # Backend processing
└── process_nanopubs.py    # Enhanced Python processor

.github/workflows/          # GitHub Actions
└── process-nanopubs.yml   # Automated processing workflow

netlify.toml               # Netlify configuration
```

## 🚀 How It Works

### 1. User Interface
- Users enter one or more nanopublication URLs
- Click "Execute Nanopublications" to start processing
- Real-time status updates during processing
- Results displayed when complete

### 2. Processing Flow
1. **Frontend Validation**: URLs are validated in the browser
2. **Netlify Function**: Triggers GitHub Actions with nanopub URLs
3. **GitHub Actions**: Sets up environment and runs Python processor
4. **Python Processor**: 
   - Fetches nanopublication data from multiple formats (.trig, .nq, .ttl, .rdf)
   - Validates and parses RDF content
   - Extracts semantic components (assertion, provenance, pubinfo)
   - Performs cross-nanopub analysis
   - Generates comprehensive reports
5. **Results**: Available as GitHub artifacts and processing summaries

### 3. Enhanced Python Processor Features

#### Robust Data Fetching
- Multiple format attempts (Trig, N-Quads, Turtle, RDF/XML)
- Intelligent content validation
- Timeout and error handling
- Support for various nanopub servers

#### Comprehensive Analysis
- RDF graph structure extraction
- Triple counting and validation
- Prefix and vocabulary analysis
- Author and temporal metadata extraction
- Cross-nanopub relationship detection

#### Rich Reporting
- Individual nanopub analysis files
- Batch processing summaries
- Cross-analysis reports
- Processing statistics and recommendations

## 🛠️ Setup Instructions

### Prerequisites
- Netlify account with site deployed
- GitHub repository with Actions enabled
- GitHub Personal Access Token with repo permissions

### Environment Variables
Set in Netlify dashboard:
```
GITHUB_TOKEN=your_github_personal_access_token
```

### File Placement
- Place `index.html`, `app.js`, `styles.css` in `public/` folder
- Place `process-nanopubs.js` in `netlify/functions/` folder  
- Place `process_nanopubs.py` in `scripts/` folder
- Place `process-nanopubs.yml` in `.github/workflows/` folder

### GitHub Actions Setup
The workflow automatically:
1. Sets up Python environment
2. Installs required dependencies
3. Runs the nanopub processor
4. Uploads results as artifacts
5. Creates processing summaries
6. Optionally commits results to repository

## 📊 Processing Outputs

### Results Structure
```
results/
├── batch_results.json          # Main processing results
├── combined_analysis.json      # Cross-nanopub analysis
└── individual/                 # Individual nanopub analyses
    ├── nanopub_001.json
    ├── nanopub_002.json
    └── ...

logs/
├── processing_summary.txt      # Human-readable summary
└── processing_debug.log       # Detailed processing log
```

### Key Metrics Provided
- **Processing Statistics**: Success rates, timing, data volumes
- **Semantic Analysis**: Graph structures, triple counts, vocabularies
- **Cross-Nanopub Patterns**: Common prefixes, author networks, temporal distribution
- **Quality Assessment**: Validation results, completeness scores
- **Recommendations**: Standardization suggestions, optimization opportunities

## 🔧 Customization Options

### Processing Behavior
Modify `process_nanopubs.py` to:
- Add custom validation rules
- Implement additional analysis types
- Change output formats
- Add integration with external services

### UI Customization  
Modify `app.js` and `styles.css` to:
- Change polling intervals
- Customize status messages
- Add additional input validation
- Modify result display formats

### Workflow Configuration
Modify `process-nanopubs.yml` to:
- Adjust timeout limits
- Add notification steps
- Configure result storage options
- Add deployment steps

## 🎯 Benefits of Simplified Approach

1. **Improved User Experience**: Single-step execution
2. **Better Error Handling**: Comprehensive validation and reporting
3. **Enhanced Analytics**: Detailed cross-nanopub analysis
4. **Scalable Processing**: GitHub Actions handles compute resources
5. **Persistent Results**: Artifacts and optional repository storage
6. **Developer Friendly**: Clear separation of concerns, easy to extend

## 🔍 Troubleshooting

### Common Issues
- **GitHub Token Issues**: Ensure token has `repo` and `actions` permissions
- **URL Validation Failures**: Check nanopub URL formats and accessibility
- **Processing Timeouts**: Adjust workflow timeout for large batches
- **CORS Errors**: Verify Netlify function CORS headers

### Debugging Steps
1. Check Netlify function logs for API call issues
2. Review GitHub Actions logs for processing errors
3. Examine uploaded artifacts for detailed error information
4. Validate nanopub URLs manually using curl or browser

This simplified architecture provides a more streamlined experience while maintaining the powerful analysis capabilities of the Science Live platform.
