#!/usr/bin/env python3
"""
Enhanced Nanopublication Processing Script
Fetches, processes, and analyzes multiple nanopublications
"""

import os
import json
import requests
import time
from datetime import datetime
from pathlib import Path
import sys
import hashlib
import re
from collections import Counter
from urllib.parse import urlparse

def setup_directories():
    """Create necessary directories for output"""
    directories = ["results", "logs", "results/individual", "results/analysis", "cache"]
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    print("✅ Output directories created")

def validate_nanopub_url(url):
    """Validate nanopublication URL format"""
    if not url.startswith(('http://', 'https://')):
        return False, "URL must start with http:// or https://"
    
    # Check if it looks like a nanopub URL
    if 'w3id.org/np/' not in url and 'nanopub' not in url.lower():
        return False, "URL doesn't appear to be a nanopublication"
    
    return True, "Valid"

def fetch_nanopub_data(url, timeout=30):
    """Enhanced nanopublication data fetching with multiple format attempts"""
    print(f"📥 Fetching: {url}")
    
    # Try different format extensions and headers
    fetch_attempts = [
        {'url': f"{url}.trig", 'accept': 'application/trig'},
        {'url': f"{url}.nq", 'accept': 'application/n-quads'},
        {'url': f"{url}.ttl", 'accept': 'text/turtle'},
        {'url': f"{url}.rdf", 'accept': 'application/rdf+xml'},
        {'url': url, 'accept': 'application/trig, application/n-quads, text/turtle, application/rdf+xml'},
        {'url': url, 'accept': '*/*'}  # Fallback
    ]
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'ScienceLive-NanopubProcessor/2.0',
        'Accept-Language': 'en-US,en;q=0.9'
    })
    
    last_error = None
    
    for attempt in fetch_attempts:
        try:
            headers = {'Accept': attempt['accept']}
            response = session.get(attempt['url'], headers=headers, timeout=timeout)
            
            if response.ok and response.text.strip():
                content = response.text.strip()
                
                # Skip HTML error pages
                if content.startswith('<!DOCTYPE') or content.startswith('<html'):
                    continue
                    
                # Basic validation - should contain some RDF-like content
                if any(keyword in content for keyword in ['@prefix', 'subject', 'predicate', 'object', '<http']):
                    print(f"✅ Successfully fetched {len(content)} characters from {attempt['url']}")
                    return content, attempt['accept']
                    
        except requests.exceptions.Timeout:
            last_error = f"Timeout after {timeout}s"
            print(f"⏰ Timeout fetching {attempt['url']}")
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            print(f"❌ Error fetching {attempt['url']}: {e}")
        except Exception as e:
            last_error = str(e)
            print(f"❌ Unexpected error with {attempt['url']}: {e}")
    
    raise Exception(f"Could not fetch nanopub data from {url}. Last error: {last_error}")

def extract_nanopub_components(rdf_data, url):
    """Extract and analyze nanopublication components"""
    components = {
        'url': url,
        'timestamp': datetime.now().isoformat(),
        'data_size': len(rdf_data),
        'line_count': len(rdf_data.split('\n')),
        'graphs': {},
        'triples_count': 0,
        'prefixes': [],
        'subjects': set(),
        'predicates': set(),
        'objects': set(),
        'metadata': {}
    }
    
    # Extract prefixes
    prefix_pattern = r'@prefix\s+(\w+):\s+<([^>]+)>'
    prefixes = re.findall(prefix_pattern, rdf_data)
    components['prefixes'] = [{'prefix': p[0], 'uri': p[1]} for p in prefixes]
    
    # Identify graph sections
    graph_sections = {
        'assertion': 'sub:assertion',
        'provenance': 'sub:provenance', 
        'pubinfo': 'sub:pubinfo',
        'head': 'sub:Head'
    }
    
    for graph_name, graph_identifier in graph_sections.items():
        if graph_identifier in rdf_data:
            components['graphs'][graph_name] = True
            # Extract content between graph markers
            pattern = f'{re.escape(graph_identifier)}\\s*{{([^}}]*)}}'
            match = re.search(pattern, rdf_data, re.DOTALL)
            if match:
                graph_content = match.group(1).strip()
                components['graphs'][f'{graph_name}_content'] = graph_content
                # Count triples in this graph
                components['graphs'][f'{graph_name}_triples'] = len([
                    line for line in graph_content.split('\n') 
                    if line.strip() and not line.strip().startswith('#')
                ])
        else:
            components['graphs'][graph_name] = False
    
    # Count total triples (rough estimate)
    lines = rdf_data.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('@'):
            if re.search(r'\s+\w+:\w+\s+', line) or '<http' in line:
                components['triples_count'] += 1
    
    # Extract basic metadata
    if 'dct:creator' in rdf_data:
        creator_match = re.search(r'dct:creator\s+([^;]+)', rdf_data)
        if creator_match:
            components['metadata']['creator'] = creator_match.group(1).strip()
    
    if 'dct:created' in rdf_data:
        created_match = re.search(r'dct:created\s+"([^"]+)"', rdf_data)
        if created_match:
            components['metadata']['created'] = created_match.group(1).strip()
    
    if 'foaf:name' in rdf_data:
        name_match = re.search(r'foaf:name\s+"([^"]+)"', rdf_data)
        if name_match:
            components['metadata']['author_name'] = name_match.group(1).strip()
    
    return components

def analyze_batch_relationships(nanopub_analyses):
    """Analyze relationships and patterns across multiple nanopublications"""
    batch_analysis = {
        'total_nanopubs': len(nanopub_analyses),
        'successful_processing': len([n for n in nanopub_analyses if n.get('status') == 'processed']),
        'total_triples': sum(n.get('triples_count', 0) for n in nanopub_analyses),
        'common_prefixes': {},
        'graph_distribution': Counter(),
        'author_network': Counter(),
        'temporal_distribution': {},
        'cross_references': [],
        'semantic_patterns': {}
    }
    
    # Analyze common prefixes
    all_prefixes = {}
    for analysis in nanopub_analyses:
        if analysis.get('prefixes'):
            for prefix_info in analysis['prefixes']:
                prefix = prefix_info['prefix']
                uri = prefix_info['uri']
                if prefix not in all_prefixes:
                    all_prefixes[prefix] = {'uri': uri, 'count': 0}
                all_prefixes[prefix]['count'] += 1
    
    batch_analysis['common_prefixes'] = {
        k: v for k, v in all_prefixes.items() 
        if v['count'] > 1
    }
    
    # Graph distribution
    for analysis in nanopub_analyses:
        if analysis.get('graphs'):
            for graph_name, present in analysis['graphs'].items():
                if present and not graph_name.endswith('_content') and not graph_name.endswith('_triples'):
                    batch_analysis['graph_distribution'][graph_name] += 1
    
    # Author network
    for analysis in nanopub_analyses:
        if analysis.get('metadata', {}).get('author_name'):
            batch_analysis['author_network'][analysis['metadata']['author_name']] += 1
    
    # Temporal distribution (by creation date)
    for analysis in nanopub_analyses:
        if analysis.get('metadata', {}).get('created'):
            try:
                created_date = analysis['metadata']['created'][:10]  # YYYY-MM-DD
                batch_analysis['temporal_distribution'][created_date] = \
                    batch_analysis['temporal_distribution'].get(created_date, 0) + 1
            except:
                pass
    
    return batch_analysis

def generate_summary_report(batch_analysis, nanopub_analyses, batch_id):
    """Generate a comprehensive summary report"""
    successful = [n for n in nanopub_analyses if n.get('status') == 'processed']
    failed = [n for n in nanopub_analyses if n.get('status') == 'error']
    
    report = f"""
=== SCIENCE LIVE NANOPUB PROCESSING REPORT ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
Batch ID: {batch_id}

=== PROCESSING SUMMARY ===
Total Nanopublications: {len(nanopub_analyses)}
Successfully Processed: {len(successful)}
Failed: {len(failed)}
Success Rate: {(len(successful)/len(nanopub_analyses)*100):.1f}%
Total Triples Analyzed: {batch_analysis['total_triples']}

=== PROCESSED NANOPUBLICATIONS ===
"""
    
    for i, analysis in enumerate(successful, 1):
        report += f"""
{i}. {analysis['url']}
   Status: ✅ Success
   Triples: {analysis.get('triples_count', 0)}
   Graphs: {', '.join(g for g, present in analysis.get('graphs', {}).items() 
                     if present and not g.endswith('_content') and not g.endswith('_triples'))}
   Data Size: {analysis.get('data_size', 0):,} characters
   Author: {analysis.get('metadata', {}).get('author_name', 'Unknown')}
"""
    
    if failed:
        report += "\n=== FAILED NANOPUBLICATIONS ===\n"
        for i, analysis in enumerate(failed, 1):
            report += f"{i}. {analysis['url']} - Error: {analysis.get('error', 'Unknown error')}\n"
    
    report += f"""
=== CROSS-NANOPUB ANALYSIS ===
Common Prefixes: {len(batch_analysis['common_prefixes'])}
"""
    
    for prefix, info in list(batch_analysis['common_prefixes'].items())[:5]:
        report += f"  - {prefix}: {info['uri']} (used in {info['count']} nanopubs)\n"
    
    report += f"""
Graph Distribution:
"""
    for graph, count in batch_analysis['graph_distribution'].most_common():
        report += f"  - {graph}: {count} nanopubs ({count/len(successful)*100:.1f}%)\n"
    
    if batch_analysis['author_network']:
        report += f"""
Author Network:
"""
        for author, count in batch_analysis['author_network'].most_common(5):
            report += f"  - {author}: {count} nanopub(s)\n"
    
    report += f"""
=== RECOMMENDATIONS ===
"""
    
    if len(successful) > 1:
        report += "✓ Sufficient data for batch analysis\n"
        if len(batch_analysis['common_prefixes']) > 3:
            report += "✓ Good semantic consistency across nanopubs\n"
        else:
            report += "⚠ Limited shared vocabularies - consider standardization\n"
    else:
        report += "⚠ Single nanopub processing - batch benefits limited\n"
    
    if batch_analysis['total_triples'] > 50:
        report += "✓ Rich semantic content available for knowledge graph construction\n"
    
    report += f"""
=== FILES GENERATED ===
- results/batch_results.json (detailed processing results)
- results/combined_analysis.json (cross-nanopub analysis)
- results/individual/*.json ({len(successful)} individual analyses)
- logs/processing_summary.txt (this report)
- logs/processing_debug.log (detailed processing log)
"""
    
    return report

def process_nanopubs():
    """Main processing function with enhanced analysis"""
    print("🚀 === SCIENCE LIVE NANOPUB PROCESSOR STARTING ===")
    start_time = time.time()
    
    # Get environment variables
    nanopub_urls_str = os.getenv('NANOPUB_URLS', '')
    batch_id = os.getenv('BATCH_ID', f'batch_{int(time.time())}')
    
    if not nanopub_urls_str:
        print("❌ ERROR: No nanopublication URLs provided")
        print("Expected NANOPUB_URLS environment variable with comma-separated URLs")
        sys.exit(1)
    
    nanopub_urls = [url.strip() for url in nanopub_urls_str.split(',') if url.strip()]
    
    print(f"📊 Processing {len(nanopub_urls)} nanopublications")
    print(f"🏷️  Batch ID: {batch_id}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    setup_directories()
    
    # Initialize results structure
    results = {
        'batch_id': batch_id,
        'timestamp': datetime.now().isoformat(),
        'total_nanopubs': len(nanopub_urls),
        'processed': 0,
        'failed': 0,
        'processing_time_seconds': 0,
        'results': []
    }
    
    nanopub_analyses = []
    
    # Process each nanopub
    for i, url in enumerate(nanopub_urls, 1):
        print(f"\n📋 --- Processing nanopub {i}/{len(nanopub_urls)} ---")
        print(f"🔗 URL: {url}")
        
        # Validate URL
        is_valid, validation_msg = validate_nanopub_url(url)
        if not is_valid:
            print(f"❌ URL validation failed: {validation_msg}")
            error_result = {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'error': f"URL validation failed: {validation_msg}"
            }
            results['results'].append(error_result)
            nanopub_analyses.append(error_result)
            results['failed'] += 1
            continue
        
        try:
            # Fetch nanopub data
            fetch_start = time.time()
            rdf_data, content_type = fetch_nanopub_data(url)
            fetch_time = time.time() - fetch_start
            
            print(f"📦 Fetched {len(rdf_data):,} characters in {fetch_time:.2f}s")
            print(f"📋 Content type: {content_type}")
            
            # Analyze nanopub structure
            analysis_start = time.time()
            analysis = extract_nanopub_components(rdf_data, url)
            analysis['status'] = 'processed'
            analysis['fetch_time_seconds'] = fetch_time
            analysis['analysis_time_seconds'] = time.time() - analysis_start
            analysis_time = analysis['analysis_time_seconds']
            
            print(f"🔍 Analysis complete in {analysis_time:.2f}s:")
            print(f"   - Triples: {analysis['triples_count']}")
            print(f"   - Graphs: {', '.join(g for g, present in analysis['graphs'].items() if present and not g.endswith('_content') and not g.endswith('_triples'))}")
            print(f"   - Prefixes: {len(analysis['prefixes'])}")
            if analysis['metadata'].get('author_name'):
                print(f"   - Author: {analysis['metadata']['author_name']}")
            
            # Save individual result
            individual_file = f"results/individual/nanopub_{i:03d}.json"
            individual_data = {
                'analysis': analysis,
                'rdf_sample': rdf_data[:2000] + "..." if len(rdf_data) > 2000 else rdf_data,
                'full_rdf_size': len(rdf_data)
            }
            
            with open(individual_file, 'w', encoding='utf-8') as f:
                json.dump(individual_data, f, indent=2, ensure_ascii=False)
            
            nanopub_analyses.append(analysis)
            results['results'].append(analysis)
            results['processed'] += 1
            
        except Exception as e:
            print(f"❌ ERROR processing {url}: {e}")
            error_result = {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'error': str(e)
            }
            results['results'].append(error_result)
            nanopub_analyses.append(error_result)
            results['failed'] += 1
    
    # Calculate total processing time
    total_time = time.time() - start_time
    results['processing_time_seconds'] = total_time
    
    print(f"\n🔬 === GENERATING BATCH ANALYSIS ===")
    
    # Perform batch analysis
    batch_analysis = analyze_batch_relationships(nanopub_analyses)
    
    # Generate comprehensive report
    summary_report = generate_summary_report(batch_analysis, nanopub_analyses, batch_id)
    
    # Save all results
    print("💾 Saving results...")
    
    # Save main results
    with open('results/batch_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Save batch analysis
    with open('results/combined_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(batch_analysis, f, indent=2, ensure_ascii=False)
    
    # Save summary report
    with open('logs/processing_summary.txt', 'w', encoding='utf-8') as f:
        f.write(summary_report)
    
    # Print final summary
    print(summary_report)
    print(f"⏱️  Total processing time: {total_time:.2f} seconds")
    print("✅ === PROCESSING COMPLETE ===")
    
    # Exit with appropriate code
    if results['failed'] > 0 and results['processed'] == 0:
        sys.exit(1)  # Complete failure
    elif results['failed'] > 0:
        sys.exit(2)  # Partial failure
    else:
        sys.exit(0)  # Success

if __name__ == "__main__":
    try:
        process_nanopubs()
    except KeyboardInterrupt:
        print("\n⚠️  Processing interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
