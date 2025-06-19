#!/usr/bin/env python3
"""
Science Live Nanopublication Content Generator
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
import sys

def setup_directories():
    """Create necessary directories for output"""
    directories = ["results", "logs", "results/content"]
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    print("Output directories created")

def generate_content_simple(nanopub_urls, content_types, ai_model, user_instructions, batch_id):
    """Simple, working content generation"""
    
    try:
        import ollama
        print(f"Testing Ollama with model: {ai_model}")
        
        # Simple test
        test_response = ollama.generate(
            model=ai_model,
            prompt="Write one sentence about science.",
            options={"temperature": 0.3}
        )
        print("Ollama working")
        
    except Exception as e:
        print(f"Ollama error: {e}")
        return {}, []
    
    templates = {
        'linkedin_post': f"""Write a professional LinkedIn post about nanopublication research.

Create engaging content about structured scientific data sharing.
{user_instructions}

Write actual LinkedIn content:""",
        
        'bluesky_post': f"""Write a short Bluesky post about nanopublication research.

Create concise content (under 280 characters) about scientific data.
{user_instructions}

Write the actual post:""",
        
        'scientific_paper': f"""Write a scientific paper section about nanopublication research.

Create academic content about structured scientific data.
{user_instructions}

Write the paper section:""",
        
        'opinion_paper': f"""Write an opinion piece about nanopublication research.

Create editorial content about the importance of structured scientific data.
{user_instructions}

Write the opinion piece:"""
    }
    
    results = {}
    generated_files = []
    
    for content_type in content_types:
        if content_type not in templates:
            print(f"Unknown content type: {content_type}")
            continue
            
        try:
            print(f"Generating {content_type}...")
            
            response = ollama.generate(
                model=ai_model,
                prompt=templates[content_type],
                options={"temperature": 0.3}
            )
            
            content = response['response'].strip()
            
            # Save files
            text_file = f"results/content/{content_type}_{batch_id}.txt"
            
            with open(text_file, 'w') as f:
                f.write(f"# {content_type.upper()} - Generated Content\n\n")
                f.write(content)
                f.write(f"\n\n## Generated: {datetime.now()}")
                f.write(f"\nModel: {ai_model}")
                f.write(f"\nBatch: {batch_id}")
                for i, url in enumerate(nanopub_urls, 1):
                    f.write(f"\n[{i}] {url}")
            
            results[content_type] = content
            generated_files.append(text_file)
            print(f"Generated {content_type} ({len(content)} characters)")
            
        except Exception as e:
            print(f"Error generating {content_type}: {e}")
    
    return results, generated_files

def main():
    """Main processing function"""
    print("=== SCIENCE LIVE CONTENT GENERATOR STARTING ===")
    start_time = time.time()
    
    # Get environment variables
    nanopub_urls_str = os.getenv('NANOPUB_URLS', '')
    batch_id = os.getenv('BATCH_ID', f'batch_{int(time.time())}')
    content_types_str = os.getenv('CONTENT_TYPES', 'linkedin_post,bluesky_post')
    ai_model = os.getenv('AI_MODEL', 'llama3:8b')
    user_instructions = os.getenv('USER_INSTRUCTIONS', 'Create engaging, accessible content')
    
    if not nanopub_urls_str:
        print("ERROR: No nanopublication URLs provided")
        print("Usage: NANOPUB_URLS='url1,url2' python scripts/process_nanopubs.py")
        return
    
    nanopub_urls = [url.strip() for url in nanopub_urls_str.split(',') if url.strip()]
    content_types = [ct.strip() for ct in content_types_str.split(',') if ct.strip()]
    
    print(f"Processing {len(nanopub_urls)} nanopublications")
    print(f"Content types: {', '.join(content_types)}")
    print(f"AI Model: {ai_model}")
    print(f"Batch ID: {batch_id}")
    print(f"Instructions: {user_instructions}")
    
    setup_directories()
    
    # Generate content
    results, generated_files = generate_content_simple(
        nanopub_urls, content_types, ai_model, user_instructions, batch_id
    )
    
    # Create summary
    total_time = time.time() - start_time
    
    summary = {
        'batch_id': batch_id,
        'total_nanopubs': len(nanopub_urls),
        'content_types_requested': content_types,
        'content_generated': len(results),
        'processing_time': total_time,
        'ai_model': ai_model,
        'user_instructions': user_instructions,
        'generated_files': generated_files,
        'nanopub_urls': nanopub_urls
    }
    
    with open('results/batch_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    # Create report
    if results:
        content_summary = '\n'.join(f"{ct}: {len(content)} chars" for ct, content in results.items())
    else:
        content_summary = "No content generated"
    
    report = f"""=== CONTENT GENERATION RESULTS ===
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Batch ID: {batch_id}

=== SUMMARY ===
Nanopublications: {len(nanopub_urls)}
Content Types: {', '.join(content_types)}
AI Model: {ai_model}
Processing Time: {total_time:.2f} seconds
Success: {len(results)}/{len(content_types)} content types

=== GENERATED CONTENT ===
{content_summary}

=== NANOPUB URLs ===
{chr(10).join(f"{i+1}. {url}" for i, url in enumerate(nanopub_urls))}

=== FILES CREATED ===
{chr(10).join(f"- {f}" for f in generated_files)}

=== USAGE ===
View generated content: cat {generated_files[0] if generated_files else 'results/content/*.txt'}
Check all files: ls -la results/content/
"""
    
    with open('logs/processing_summary.txt', 'w') as f:
        f.write(report)
    
    print(report)
    
    if results:
        print("=== CONTENT GENERATION SUCCESSFUL ===")
        print(f"Generated {len(results)} content types")
        print(f"Files saved in results/content/")
    else:
        print("=== NO CONTENT GENERATED ===")
        print("Check Ollama is running: ollama serve &")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
