import { useState } from 'react'
import { ProductList } from './ProductList'
import { ProductForm } from './ProductForm'

export function ProductsPage() {
  const [view, setView] = useState<'list' | 'form'>('list')

  // We could pass down a product ID to edit, but for now we just toggle between list and create.
  
  if (view === 'form') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ProductForm 
          onSuccess={() => setView('list')}
          onCancel={() => setView('list')}
        />
      </div>
    )
  }

  return <ProductList onAddNew={() => setView('form')} />
}
