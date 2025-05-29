#!/usr/bin/env python3
"""
Science Live Nanopublication Processor
Using the nanopub library for proper nanopublication handling
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
import sys
from collections import Counter

# Import nanopub library
from nanopub import Nanopub, NanopubConf
import rdflib

def setup_directories():
    """Create necessary directories for output"""
    directories = ["results", "logs", "results/individual", "results/web"]
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    print("✅ Output directories created")

def extract_nanopub_info(nanopub_obj, url):
    """Extract information from nanopub object using nanopub library"""
    info = {
        'url': url,
        'timestamp': datetime.now().isoformat(),
        'status': 'processed',
        'graphs': {},
        'triples_count': 0,
        'metadata': {},
        'content': {}
    }
    
    try:
        # Get basic info
        info['uri'] = str(nanopub_obj.uri) if hasattr(nanopub_obj, 'uri') else url
        
        # Extract graph information
        if hasattr(nanopub_obj, 'assertion') and nanopub_obj.assertion:
            info['graphs']['assertion'] = True
            assertion_triples = list(nanopub_obj.assertion)
            info['triples_count'] += len(assertion_triples)
            info['content']['assertion_triples'] = [
                {
                    'subject': str(triple[0]),
                    'predicate': str(triple[1]), 
                    'object': str(triple[2])
                } for triple in assertion_triples[:10]  # Limit to first 10 for JSON
            ]
        else:
            info['graphs']['assertion'] = False
            
        if hasattr(nanopub_obj, 'provenance') and nanopub_obj.provenance:
            info['graphs']['provenance'] = True
            prov_triples = list(nanopub_obj.provenance)
            info['triples_count'] += len(prov_triples)
            info['content']['provenance_triples'] = [
                {
                    'subject': str(triple[0]),
                    'predicate': str(triple[1]),
                    'object': str(triple[2])
                } for triple in prov_triples[:10]
            ]
        else:
            info['graphs']['provenance'] = False
            
        if hasattr(nanopub_obj, 'pubinfo') and nanopub_obj.pubinfo:
            info['graphs']['pubinfo'] = True
            pubinfo_triples = list(nanopub_obj.pubinfo)
            info['triples_count'] += len(pubinfo_triples)
            info['content']['pubinfo_triples'] = [
                {
                    'subject': str(triple[0]),
                    'predicate': str(triple[1]),
                    'object': str(triple[2])
                } for triple in pubinfo_triples[:10]
            ]
        else:
            info['graphs']['pubinfo'] = False
        
        # Extract metadata from pubinfo
        if hasattr(nanopub_obj, 'pubinfo') and nanopub_obj.pubinfo:
            for s, p, o in nanopub_obj.pubinfo:
                pred_str = str(p)
                if 'creator' in pred_str.lower():
                    info['metadata']['creator'] = str(o)
                elif 'created' in pred_str.lower():
                    info['metadata']['created'] = str(o)
                elif 'name' in pred_str.lower():
                    info['metadata']['author_name'] = str(o)
        
        # Get RDF serialization for display
        if hasattr(nanopub_obj, 'rdf'):
            info['rdf_turtle'] = nanopub_obj.rdf.serialize(format='turtle')[:2000]  # First 2000 chars
        
        print(f"✅ Successfully extracted nanopub info:")
        print(f"   - URI: {info['uri']}")
        print(f"   - Total triples: {info['triples_count']}")
        print(f"   - Graphs: {', '.join(g for g, present in info['graphs'].items() if present)}")
        if info['metadata'].get('author_name'):
            print(f"   - Author: {info['metadata']['author_name']}")
            
    except Exception as e:
        print(f"⚠️  Error extracting nanopub info: {e}")
        info['extraction_error'] = str(e)
    
    return info

def analyze_batch_relationships(nanopub_analyses):
    """Analyze relationships across multiple nanopublications"""
    batch_analysis = {
        'total_nanopubs': len(nanopub_analyses),
        'successful_processing': len([n for n in nanopub_analyses if n.get('status') == 'processed']),
        'total_triples': sum(n.get('triples_count', 0) for n in nanopub_analyses),
        'graph_distribution': Counter(),
        'author_network': Counter(),
        'uri_patterns': Counter(),
        'processing_summary': {}
    }
    
    # Analyze graph distribution
    for analysis in nanopub_analyses:
        if analysis.get('graphs'):
            for graph_name, present in analysis['graphs'].items():
                if present:
                    batch_analysis['graph_distribution'][graph_name] += 1
    
    # Analyze authors
    for analysis in nanopub_analyses:
        if analysis.get('metadata', {}).get('author_name'):
            batch_analysis['author_network'][analysis['metadata']['author_name']] += 1
    
    # Analyze URI patterns
    for analysis in nanopub_analyses:
        uri = analysis.get('uri', analysis.get('url', ''))
        if 'w3id.org' in uri:
            batch_analysis['uri_patterns']['w3id.org'] += 1
        elif 'purl.org' in uri:
            batch_analysis['uri_patterns']['purl.org'] += 1
        else:
            batch_analysis['uri_patterns']['other'] += 1
    
    return batch_analysis

def generate_web_display_data(nanopub_analyses, batch_analysis, batch_id):
    """Generate JSON data for web display"""
    web_data = {
        'batch_id': batch_id,
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total': len(nanopub_analyses),
            'successful': len([n for n in nanopub_analyses if n.get('status') == 'processed']),
            'failed': len([n for n in nanopub_analyses if n.get('status') == 'error']),
            'total_triples': batch_analysis['total_triples']
        },
        'nanopubs': [],
        'batch_analysis': batch_analysis
    }
    
    # Add individual nanopub data for display
    for i, analysis in enumerate(nanopub_analyses):
        nanopub_display = {
            'index': i + 1,
            'url': analysis.get('url', ''),
            'uri': analysis.get('uri', ''),
            'status': analysis.get('status', 'unknown'),
            'triples_count': analysis.get('triples_count', 0),
            'graphs': analysis.get('graphs', {}),
            'metadata': analysis.get('metadata', {}),
            'error': analysis.get('error', None)
        }
        
        # Add sample content for successful ones
        if analysis.get('status') == 'processed' and analysis.get('content'):
            nanopub_display['sample_content'] = analysis['content']
        
        web_data['nanopubs'].append(nanopub_display)
    
    return web_data

def process_nanopubs():
    """Main processing function using nanopub library"""
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
    
    # Initialize results
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
        
        try:
            # Fetch nanopub using nanopub library
            fetch_start = time.time()
            print("📥 Fetching nanopub...")
            
            np = Nanopub(
              source_uri=url,
              conf=NanopubConf(use_test_server=False)
            )
            nanopub_obj = np
            fetch_time = time.time() - fetch_start
            
            print(f"✅ Fetched nanopub in {fetch_time:.2f}s")
            
            # Extract information
            analysis_start = time.time()
            analysis = extract_nanopub_info(nanopub_obj, url)
            analysis['fetch_time_seconds'] = fetch_time
            analysis['analysis_time_seconds'] = time.time() - analysis_start
            
            # Save individual result
            individual_file = f"results/individual/nanopub_{i:03d}.json"
            with open(individual_file, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, indent=2, ensure_ascii=False)
            
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
    
    print(f"\n🔬 === GENERATING ANALYSIS ===")
    
    # Perform batch analysis
    batch_analysis = analyze_batch_relationships(nanopub_analyses)
    
    # Generate web display data
    web_data = generate_web_display_data(nanopub_analyses, batch_analysis, batch_id)
    
    # Save results
    print("💾 Saving results...")
    
    # Save main results
    with open('results/batch_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Save batch analysis
    with open('results/combined_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(batch_analysis, f, indent=2, ensure_ascii=False)
    
    # Save web display data
    with open('results/web/display_data.json', 'w', encoding='utf-8') as f:
        json.dump(web_data, f, indent=2, ensure_ascii=False)
    
    # Generate summary report
    summary_report = f"""
=== SCIENCE LIVE NANOPUB PROCESSING REPORT ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
Batch ID: {batch_id}

=== PROCESSING SUMMARY ===
Total Nanopublications: {len(nanopub_analyses)}
Successfully Processed: {results['processed']}
Failed: {results['failed']}
Success Rate: {(results['processed']/len(nanopub_analyses)*100):.1f}%
Total Triples Analyzed: {batch_analysis['total_triples']}
Processing Time: {total_time:.2f} seconds

=== PROCESSED NANOPUBLICATIONS ===
"""
    
    successful = [n for n in nanopub_analyses if n.get('status') == 'processed']
    for i, analysis in enumerate(successful, 1):
        summary_report += f"""
{i}. {analysis['url']}
   Status: ✅ Success
   URI: {analysis.get('uri', 'N/A')}
   Triples: {analysis.get('triples_count', 0)}
   Graphs: {', '.join(g for g, present in analysis.get('graphs', {}).items() if present)}
   Author: {analysis.get('metadata', {}).get('author_name', 'Unknown')}
"""
    
    failed = [n for n in nanopub_analyses if n.get('status') == 'error']
    if failed:
        summary_report += "\n=== FAILED NANOPUBLICATIONS ===\n"
        for i, analysis in enumerate(failed, 1):
            summary_report += f"{i}. {analysis['url']} - Error: {analysis.get('error', 'Unknown error')}\n"
    
    summary_report += f"""
=== GRAPH DISTRIBUTION ===
"""
    for graph, count in batch_analysis['graph_distribution'].items():
        percentage = (count / results['processed'] * 100) if results['processed'] > 0 else 0
        summary_report += f"  - {graph}: {count} nanopubs ({percentage:.1f}%)\n"
    
    if batch_analysis['author_network']:
        summary_report += f"""
=== AUTHOR NETWORK ===
"""
        for author, count in batch_analysis['author_network'].most_common(5):
            summary_report += f"  - {author}: {count} nanopub(s)\n"
    
    summary_report += f"""
=== FILES GENERATED ===
- results/batch_results.json (detailed processing results)
- results/combined_analysis.json (cross-nanopub analysis)
- results/web/display_data.json (web display data)
- results/individual/*.json ({results['processed']} individual analyses)
- logs/processing_summary.txt (this report)
"""
    
    # Save summary report
    with open('logs/processing_summary.txt', 'w', encoding='utf-8') as f:
        f.write(summary_report)
    
    print(summary_report)
    print(f"⏱️  Total processing time: {total_time:.2f} seconds")
    print("✅ === PROCESSING COMPLETE ===")
    
    # Exit appropriately
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
