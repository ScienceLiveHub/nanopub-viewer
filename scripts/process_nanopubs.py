#!/usr/bin/env python3
"""
Nanopublication Processing Script
Processes multiple nanopublications for batch analysis
"""

import os
import json
import requests
import time
from datetime import datetime
from pathlib import Path
import sys

def setup_directories():
    """Create necessary directories for output"""
    Path("results").mkdir(exist_ok=True)
    Path("logs").mkdir(exist_ok=True)
    Path("results/individual").mkdir(exist_ok=True)

def fetch_nanopub_data(url):
    """Fetch nanopublication data from URL"""
    attempts = [
        f"{url}.trig",
        f"{url}.nq", 
        f"{url}.ttl",
        url
    ]
    
    headers = {
        'Accept': 'application/trig, application/n-quads, text/turtle, application/rdf+xml',
        'User-Agent': 'ScienceLive-NanopubProcessor/1.0'
    }
    
    for attempt_url in attempts:
        try:
            print(f"Fetching: {attempt_url}")
            response = requests.get(attempt_url, headers=headers, timeout=30)
            if response.ok and response.text.strip():
                if not response.text.strip().startswith('<!DOCTYPE'):
                    return response.text
        except Exception as e:
            print(f"Failed to fetch {attempt_url}: {e}")
            continue
    
    raise Exception(f"Could not fetch nanopub data from {url}")

def analyze_nanopub(url, rdf_data):
    """Analyze a single nanopublication"""
    analysis = {
        'url': url,
        'timestamp': datetime.now().isoformat(),
        'status': 'processed',
        'data_size': len(rdf_data),
        'format': 'rdf',
        'graphs': [],
        'triples_count': 0
    }
    
    # Basic RDF analysis
    lines = rdf_data.split('\n')
    analysis['line_count'] = len(lines)
    
    # Count basic elements
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('@'):
            if ' ' in line:
                analysis['triples_count'] += 1
    
    # Identify graph sections
    if 'sub:assertion' in rdf_data:
        analysis['graphs'].append('assertion')
    if 'sub:provenance' in rdf_data:
        analysis['graphs'].append('provenance') 
    if 'sub:pubinfo' in rdf_data:
        analysis['graphs'].append('pubinfo')
    
    return analysis

def process_nanopubs():
    """Main processing function"""
    print("=== Nanopub Processing Started ===")
    
    # Get environment variables
    nanopub_urls_str = os.getenv('NANOPUB_URLS', '')
    nanopub_count = int(os.getenv('NANOPUB_COUNT', '0'))
    batch_id = os.getenv('BATCH_ID', 'unknown')
    
    if not nanopub_urls_str:
        print("ERROR: No nanopub URLs provided")
        sys.exit(1)
    
    nanopub_urls = [url.strip() for url in nanopub_urls_str.split(',') if url.strip()]
    
    print(f"Processing {len(nanopub_urls)} nanopublications")
    print(f"Batch ID: {batch_id}")
    
    setup_directories()
    
    results = {
        'batch_id': batch_id,
        'timestamp': datetime.now().isoformat(),
        'total_nanopubs': len(nanopub_urls),
        'processed': 0,
        'failed': 0,
        'results': []
    }
    
    # Process each nanopub
    for i, url in enumerate(nanopub_urls, 1):
        print(f"\n--- Processing nanopub {i}/{len(nanopub_urls)} ---")
        print(f"URL: {url}")
        
        try:
            # Fetch data
            rdf_data = fetch_nanopub_data(url)
            print(f"Fetched {len(rdf_data)} characters of RDF data")
            
            # Analyze
            analysis = analyze_nanopub(url, rdf_data)
            print(f"Analysis complete: {analysis['triples_count']} triples, {len(analysis['graphs'])} graphs")
            
            # Save individual result
            individual_file = f"results/individual/nanopub_{i}.json"
            with open(individual_file, 'w') as f:
                json.dump({
                    'analysis': analysis,
                    'rdf_data': rdf_data[:1000] + "..." if len(rdf_data) > 1000 else rdf_data
                }, f, indent=2)
            
            results['results'].append(analysis)
            results['processed'] += 1
            
        except Exception as e:
            print(f"ERROR processing {url}: {e}")
            error_result = {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'error': str(e)
            }
            results['results'].append(error_result)
            results['failed'] += 1
    
    # Generate combined analysis
    combined_analysis = {
        'batch_summary': results,
        'cross_nanopub_analysis': {
            'common_graphs': [],
            'total_triples': sum(r.get('triples_count', 0) for r in results['results'] if r.get('triples_count')),
            'successful_processing_rate': results['processed'] / len(nanopub_urls) * 100
        }
    }
    
    # Find common elements
    all_graphs = []
    for result in results['results']:
        if 'graphs' in result:
            all_graphs.extend(result['graphs'])
    
    from collections import Counter
    graph_counts = Counter(all_graphs)
    combined_analysis['cross_nanopub_analysis']['graph_frequency'] = dict(graph_counts)
    
    # Save results
    with open('results/batch_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    with open('results/combined_analysis.json', 'w') as f:
        json.dump(combined_analysis, f, indent=2)
    
    # Create summary log
    summary = f"""
=== NANOPUB PROCESSING SUMMARY ===
Batch ID: {batch_id}
Timestamp: {datetime.now().isoformat()}
Total Nanopubs: {len(nanopub_urls)}
Successfully Processed: {results['processed']}
Failed: {results['failed']}
Success Rate: {results['processed']/len(nanopub_urls)*100:.1f}%
Total Triples: {combined_analysis['cross_nanopub_analysis']['total_triples']}

Processed URLs:
{chr(10).join(f"- {url}" for url in nanopub_urls)}

Results saved to results/ directory
"""
    
    with open('logs/processing_summary.txt', 'w') as f:
        f.write(summary)
    
    print(summary)
    print("=== Processing Complete ===")

if __name__ == "__main__":
    process_nanopubs()
