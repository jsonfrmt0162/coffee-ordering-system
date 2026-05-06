import { checkout } from '@/api/checkoutService'
import { paymongoClient } from '@/api/paymongo'
import { apiUrl } from '@/config/config'
import { useErrorStore } from '@/store/useErrorStore'
import { useOrderStore } from '@/store/useOrderStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Swal from 'sweetalert2'

export const useCheckout = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form) => {
      let paymentMethodId = null

      if (form.payment_method !== 'cash') {
        const paymentMethod = await paymongoClient(form)
        paymentMethodId = paymentMethod?.data.id
      }

      const payload = {
        ...form,
        payment_method_id: paymentMethodId,
      }
      const orderResponse = await checkout(payload)
      return orderResponse
    },
    mutationKey: ['payment_process'],
    onSuccess: async (response) => {
      console.log(`${apiUrl}/${response.order_id}`)
      const ws = new WebSocket(`${apiUrl}/${response.order_id}`)
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.status === 'paid') {
          Swal.fire({
            title: 'Payment Successful!',
            icon: 'success',
          })
        }
      }
      if (response.redirect_url) {
        window.location.href = response.redirect_url
      }

      queryClient.invalidateQueries({ queryKey: ['user_cart'] })
      useOrderStore.getState().setIsCheckOutOpen(false)
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: error?.response?.detail || 'Something Went Wrong !',
      })
      console.log(error)
      useErrorStore.getState().setError(error?.response?.data || 'Something Went Wrong !')
    },
  })
}
